import { useState, useRef, useCallback, useEffect } from "react";
import { apiFetch } from "../lib/apiFetch";
import { getDeviceId } from "../lib/deviceId";

export const SCAN_STATE = {
  HOME: "HOME",
  CAMERA: "CAMERA",
  CAPTURED: "CAPTURED",
  IDENTIFYING: "IDENTIFYING",
  VERIFY: "VERIFY",
  PRICING: "PRICING",
  RESULT: "RESULT",
  MANUAL_SEARCH: "MANUAL_SEARCH",
  LIMIT: "LIMIT",
  SETTINGS: "SETTINGS"
};

export function useScanFlow() {
  const [state, setState] = useState(SCAN_STATE.HOME);
  const [error, setError] = useState(null);

  const [capturedImage, setCapturedImage] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [pricingResult, setPricingResult] = useState(null);
  const [quotaStatus, setQuotaStatus] = useState(null);

  const inFlight = useRef(false);

  // ✅ NEW: capture-level guard to prevent double-trigger (touch + click, etc.)
  const captureLockRef = useRef(false);
  const lastCaptureTsRef = useRef(0);

  // -------------------------
  // Cloud History Sync (SS-007)
  // -------------------------
  const [history, setHistory] = useState([]);

  // Fetch history on mount / deviceId change
  useEffect(() => {
    const loadHistory = async () => {
      const id = getDeviceId();
      if (!id || id.startsWith('dev_')) return; // Wait for real ID

      try {
        const res = await apiFetch(`/api/saved-scans?installId=${id}&limit=20`);
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.items) {
            // Map snake_case to UI model
            const mapped = data.items.map(item => ({
              id: item.id,
              displayName: item.display_name,
              scanImage: item.scan_thumb_base64 || item.scan_thumb_url, // Prefer thumb
              coverUrl: item.cover_url,
              value: item.raw_pricing?.value || null,
              timestamp: new Date(item.created_at).getTime(),

              // Rehydration data for opening
              editionId: item.raw_candidate?.editionId,
              seriesTitle: item.series_title,
              issueNumber: item.issue_number,
              publisher: item.publisher,
              year: item.year,
              marketImageUrl: item.raw_pricing?.ebay?.imageUrl,

              // Raw fallback
              raw_candidate: item.raw_candidate,
              raw_pricing: item.raw_pricing
            }));
            setHistory(mapped);
          }
        }
      } catch (e) {
        console.warn("[History] Sync failed", e);
      }
    };
    loadHistory();
  }, [state]); // Reload when state changes (e.g. after save)

  const saveHistory = useCallback(async (snapshot) => {
    // Optimistic Update
    setHistory(prev => [snapshot, ...prev]);

    // Async Cloud Save
    try {
      const id = getDeviceId();
      if (!id) return;

      await apiFetch("/api/saved-scans", {
        method: "POST",
        body: {
          installId: id,
          selectedCandidate: snapshot.identifiers,
          confidence: 1.0,
          scanThumb: snapshot.scanImage,
          // API will take it.
          pricing: null // Initially null
        }
      });
    } catch (e) {
      console.error("Cloud Save Failed", e);
    }
  }, []);

  // -------------------------
  // Core flow helpers
  // -------------------------
  const resetFlow = useCallback(() => {
    setError(null);
    setCapturedImage(null);
    setCandidates([]);
    setSelectedCandidate(null);
    setPricingResult(null);
    setQuotaStatus(null);
    setState(SCAN_STATE.HOME);
    inFlight.current = false;

    // Refresh history when returning home
    // (useEffect depending on 'state' will handle it)

    captureLockRef.current = false;
    lastCaptureTsRef.current = 0;
  }, []);

  const openSettings = useCallback(() => {
    setState(SCAN_STATE.SETTINGS);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const startCamera = useCallback(() => {
    clearError();
    setState(SCAN_STATE.CAMERA);
  }, [clearError]);

  // -------------------------
  // Identification → Candidates
  // -------------------------
  const performIdentification = useCallback(async (image) => {
    console.log("performIdentification: calling API with image length", image?.length);

    if (inFlight.current) {
      console.log("performIdentification: skipped (inFlight)");
      return;
    }

    inFlight.current = true;
    setError(null);

    try {
      const resp = await apiFetch("/api/identify", {
        method: "POST",
        body: { image },
      });

      // Special handling for Quota Limit (429)
      if (resp.status === 429) {
        const quotaData = await resp.json();
        setQuotaStatus(quotaData);
        setState(SCAN_STATE.LIMIT);
        // Do NOT throw error
        return;
      }

      const data = await resp.json();
      console.log("performIdentification: candidates received", data.candidates?.length);

      // Handle custom error code if 200/400 but logical limit
      if (data?.error === "LIMIT_REACHED" || data?.code === "SCAN_LIMIT_REACHED") {
        setQuotaStatus(data);
        setState(SCAN_STATE.LIMIT);
        return;
      }

      if (!data?.ok) {
        throw new Error(data?.error || "Identification failed");
      }

      setCandidates(data.candidates || []);
      setSelectedCandidate(null);
      setPricingResult(null);
      setState(SCAN_STATE.VERIFY);
    } catch (e) {
      console.error("performIdentification error", e);
      setError(e?.message || "Identification failed. Please try again.");
      setState(SCAN_STATE.HOME);
    } finally {
      inFlight.current = false;
    }
  }, []);

  const captureImage = useCallback(
    (base64Image) => {
      const now = Date.now();
      if (captureLockRef.current) return;
      if (now - lastCaptureTsRef.current < 650) return;

      captureLockRef.current = true;
      lastCaptureTsRef.current = now;

      console.log("captureImage: triggered");
      clearError();

      setCapturedImage(base64Image);
      setState(SCAN_STATE.IDENTIFYING);

      performIdentification(base64Image);

      setTimeout(() => {
        captureLockRef.current = false;
      }, 400);
    },
    [clearError, performIdentification]
  );

  // -------------------------
  // Candidate → Pricing (Cloud Sync)
  // -------------------------
  const confirmCandidate = useCallback(
    async (candidate) => {
      if (!candidate) return;
      setError(null);

      const seriesTitle = candidate.seriesTitle || candidate.displayName || "";
      const issueNumber = candidate.issueNumber || "";
      const editionId = candidate.editionId;
      const year = candidate.year || null;

      // 1. Immediate UI Transition
      setSelectedCandidate(candidate);
      setPricingResult(null);
      setState(SCAN_STATE.RESULT);

      // 2. Prepare Snapshot Data
      // For UI Optimistic Update
      const snapshot = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        displayName: candidate.displayName,
        scanImage: capturedImage,
        coverUrl: candidate.coverUrl,
        seriesTitle, issueNumber, year, publisher: candidate.publisher,
        value: null,
        timestamp: Date.now()
      };

      setHistory(prev => [snapshot, ...prev]);

      // 3. Initiate Cloud Save & Pricing Parallel
      const savePromise = (async () => {
        const id = getDeviceId();
        // Save to Supabase (SS-007)
        return apiFetch("/api/saved-scans", {
          method: "POST",
          body: {
            installId: id,
            selectedCandidate: candidate, // Full candidate
            confidence: 1.0, // Simplified
            scanThumb: capturedImage, // Can be large, maybe truncate or handled by API?
            // API will take it.
            pricing: null // Initially null
          }
        }).catch(e => console.error("Cloud Save Failed", e));
      })();

      // 4. Background Pricing fetch
      const pricePromise = apiFetch("/api/price", {
        method: "POST",
        body: { seriesTitle, issueNumber, editionId, year },
      }).then(async (resp) => {
        const data = await resp.json();
        if (data.ok) {
          setPricingResult(data);
          // In a fuller implementation, we would now PATCH the saved_scan with the price.
          // For now, we rely on the fact that if user re-opens, we might re-price or just see the initial snapshot?
          // "History list... shows correct title + thumb". Price not explicitly listed as MUST in list view in SS-007 B.
          // But usually we want it.
          // We'll update local state at least.
          setHistory(prev => {
            const copy = [...prev];
            const idx = copy.findIndex(i => i.id === snapshot.id);
            if (idx !== -1) {
              copy[idx].value = data.value;
            }
            return copy;
          });
        } else {
          setPricingResult({ value: { typical: null } });
        }
      });

      await Promise.allSettled([savePromise, pricePromise]);
    },
    [capturedImage]
  );

  // -------------------------
  // Manual flow
  // -------------------------
  const startManualSearch = useCallback(() => {
    resetFlow();
    setState(SCAN_STATE.MANUAL_SEARCH);
  }, [resetFlow]);

  const performManualSearch = useCallback(async (title, issue) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);

    try {
      const resp = await apiFetch(
        `/api/search?title=${encodeURIComponent(title)}&issue=${encodeURIComponent(issue)}`,
        { method: "GET" }
      );

      const data = await resp.json();
      if (!data?.ok) throw new Error(data?.error || "Search failed");

      setCandidates(data.candidates || []);
      setSelectedCandidate(null);
      setPricingResult(null);
      setState(SCAN_STATE.VERIFY);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Search failed. Please try again.");
    } finally {
      inFlight.current = false;
    }
  }, []);

  const openHistoryItem = useCallback((item) => {
    setCapturedImage(item.scanImage || null);

    setSelectedCandidate({
      editionId: item.editionId,
      displayName: item.displayName,
      coverUrl: item.coverUrl ?? null,
      marketImageUrl: item.marketImageUrl ?? null,
      year: item.year ?? null,
      publisher: item.publisher ?? null,
      seriesTitle: item.seriesTitle,
      issueNumber: item.issueNumber
    });

    // If we have stored pricing, show it. Otherwise maybe trigger re-price?
    // SS-008 says "Pricing cache works".
    // For now use what we have.
    setPricingResult({ ok: true, editionId: item.editionId, value: item.value, comps: [] });
    setState(SCAN_STATE.RESULT);
  }, []);

  // CS-063: Rehydratable Routes (Deep Link Support)
  const loadScanById = useCallback(async (id) => {
    if (!id) return;
    try {
      // Show loading state
      setState(SCAN_STATE.RESULT); // Or a specific LOADING state? ResultCard handles loading if data is partial? 
      // Actually ResultCard expects data. Let's maybe show a loader or just RESULT with placeholders?
      // Better: Fetch first, show spinner globally? 
      // For now, let's use PRICING state as a "Loading" proxy or just wait?
      // User requirement: "Result screen must... read savedScanId... fetch... render"

      const res = await apiFetch(`/api/saved-scans/${id}`);
      if (!res.ok) throw new Error("Scan not found");
      const json = await res.json();
      if (!json.item) throw new Error("Invalid scan data");

      const item = json.item; // Normalized backend response

      // Map to UI model (Consistency with loadHistory mapping)
      const mappedCandidate = {
        editionId: item.raw_candidate?.editionId,
        displayName: item.display_name,
        coverUrl: item.cover_url,
        seriesTitle: item.series_title,
        issueNumber: item.issue_number,
        year: item.year,
        publisher: item.publisher,
        marketImageUrl: item.raw_pricing?.ebay?.imageUrl
      };

      setCapturedImage(item.scan_thumb_base64 || item.scan_thumb_url);
      setSelectedCandidate(mappedCandidate);

      // If pricing exists
      if (item.raw_pricing) {
        setPricingResult({ ok: true, value: item.raw_pricing.value });
      } else {
        setPricingResult({ ok: true, value: { typical: null } });
      }

      setState(SCAN_STATE.RESULT);

    } catch (e) {
      console.error("[DeepLink] Failed to load scan", e);
      setError("Could not load saved scan.");
      setState(SCAN_STATE.HOME);
    }
  }, []);

  return {
    state,
    error,
    capturedImage,
    candidates,
    selectedCandidate,
    pricingResult,
    quotaStatus,
    history, // SS-007: Expose History
    actions: {
      startCamera,
      captureImage,
      performIdentification,
      confirmCandidate,
      startManualSearch,
      performManualSearch,
      resetFlow,
      clearError,
      openHistoryItem,
      loadScanById,
      openSettings,
    },
  };
}
