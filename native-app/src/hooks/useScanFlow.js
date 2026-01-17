import { useState, useRef, useCallback, useEffect } from "react";
import { apiFetch } from "../lib/apiFetch";
import { getInstallId, setInstallId } from "../lib/installId";
import { Device } from "@capacitor/device";
import { App as CapacitorApp } from "@capacitor/app";

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

  // CS-310: Identity Status
  // "idle" | "loading" | "ready" | "error"
  const [identityStatus, setIdentityStatus] = useState("loading");
  const [identityError, setIdentityError] = useState(null);

  // CS-311: Queued Scan
  // If user captures before identity is ready, we store base64 here
  const [pendingCapture, setPendingCapture] = useState(null);

  const inFlight = useRef(false);

  // ✅ NEW: capture-level guard to prevent double-trigger (touch + click, etc.)
  const captureLockRef = useRef(false);
  const lastCaptureTsRef = useRef(0);

  // -------------------------
  // Cloud History Sync (SS-007)
  // -------------------------
  const [history, setHistory] = useState([]);

  // Fetch history on mount / initialization (CS-303 / CS-310)
  useEffect(() => {
    const initAndLoad = async () => {
      setIdentityStatus("loading");
      let id = null;

      try {
        // 1. Check local persistence first
        id = await getInstallId();

        if (!id) {
          // Handshake (Non-blocking UI, but status is loading)
          const info = await Device.getInfo().catch(() => ({ platform: 'web' }));
          const appInfo = await CapacitorApp.getInfo().catch(() => ({ version: '1.0.0' }));

          const res = await apiFetch("/api/install", {
            method: "POST",
            body: {
              platform: info.platform,
              appVersion: appInfo.version
            }
          });

          if (res.ok) {
            const data = await res.json();
            if (data.installId) {
              id = data.installId;
              await setInstallId(id);
              console.log("[Init] New Install ID registered:", id);
            }
          }
        }
      } catch (e) {
        console.warn("[Init] Handshake failed.", e);
        // Soft fail: we still allow app usage, but some features might limit
        setIdentityError("Connection issue");
        setIdentityStatus("error");
        // Note: We do NOT return here, we allow history load attempt if we have an old ID? 
        // If we failed to get ANY ID, we are effectively offline/unauth.
        if (!id) return;
      }

      if (id) {
        setIdentityStatus("ready");
        // 2. Load History (Background)
        try {
          const res = await apiFetch(`/api/saved-scans?installId=${id}&limit=20`);
          if (res.ok) {
            const data = await res.json();
            if (data.ok && data.items) {
              const mapped = data.items.map(item => ({
                id: item.id,
                displayName: item.display_name,
                scanImage: item.scan_thumb_base64 || item.scan_thumb_url,
                coverUrl: item.cover_url,
                value: item.raw_pricing?.value || null,
                timestamp: new Date(item.created_at).getTime(),
                editionId: item.raw_candidate?.editionId,
                seriesTitle: item.series_title,
                issueNumber: item.issue_number,
                publisher: item.publisher,
                year: item.year,
                marketImageUrl: item.raw_pricing?.ebay?.imageUrl,
                raw_candidate: item.raw_candidate,
                raw_pricing: item.raw_pricing
              }));
              setHistory(mapped);
            }
          }
        } catch (e) {
          console.warn("[History] Sync failed", e);
        }
      }
    };
    initAndLoad();
  }, [state]);

  // CS-311: Watch for Pending Capture + Identity Ready
  useEffect(() => {
    if (identityStatus === "ready" && pendingCapture) {
      console.log("CS-311: Processing queued capture now that identity is ready.");
      // Trigger identification
      const image = pendingCapture;
      setPendingCapture(null); // Clear queue
      performIdentification(image);
    }
  }, [identityStatus, pendingCapture]);

  // -------------------------
  // Core flow helpers (CS-301)
  // -------------------------
  const resetFlow = useCallback(() => {
    // 1. Force Clean State
    setError(null);
    setCapturedImage(null);
    setCandidates([]);
    setSelectedCandidate(null);
    setPricingResult(null);
    setQuotaStatus(null);
    inFlight.current = false;
    captureLockRef.current = false;
    lastCaptureTsRef.current = 0;

    // 2. Navigation Safety
    // Ensure we are truly aiming for HOME
    setState(SCAN_STATE.HOME);
  }, []);

  const openSettings = useCallback(() => {
    setState(SCAN_STATE.SETTINGS);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const startCamera = useCallback(() => {
    clearError();
    setState(SCAN_STATE.CAMERA);
  }, [clearError]);

  // CS-301: Added missing history actions
  const clearHistory = useCallback(async () => {
    setHistory([]);
    // TODO: Could call API DELETE endpoint if implemented
  }, []);

  const deleteHistoryItem = useCallback((id) => {
    setHistory(prev => prev.filter(i => i.id !== id));
    // TODO: call API DELETE /saved-scans/:id
  }, []);

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

  (base64Image) => {
    const now = Date.now();
    if (captureLockRef.current) return;
    if (now - lastCaptureTsRef.current < 650) return;

    captureLockRef.current = true;
    lastCaptureTsRef.current = now;

    console.log("captureImage: triggered");
    clearError();

    setCapturedImage(base64Image);
    // CS-311: Queue if identity not ready
    if (identityStatus !== "ready") {
      console.log("Identity not ready, queuing capture...");
      setPendingCapture(base64Image);
      setState(SCAN_STATE.IDENTIFYING); // Show loading UI immediately
      // The useEffect will pick this up when status -> ready
    } else {
      setState(SCAN_STATE.IDENTIFYING);
      performIdentification(base64Image);
    }

    setTimeout(() => {
      captureLockRef.current = false;
    }, 400);
  },
    [clearError, performIdentification, identityStatus]
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

      // 2. Prepare Snapshot Data (CS-303 Stable ID)
      // Use editionId + timestamp to ensure uniqueness per scan event, but stable for list
      const snapshotId = `${editionId}:${Date.now()}`;

      const snapshot = {
        id: snapshotId,
        displayName: candidate.displayName,
        scanImage: capturedImage,
        coverUrl: candidate.coverUrl,
        seriesTitle, issueNumber, year, publisher: candidate.publisher,
        value: null,
        timestamp: Date.now()
      };

      setHistory(prev => [snapshot, ...prev]);

      // 3. Initiate Cloud Save & Pricing Parallel (CS-302)
      const savePromise = (async () => {
        // Use ensureInstallId directly (although apiFetch calls it too, 
        // calling it here ensures we don't start specific logic until ready)
        // Actually apiFetch handles it, but we need it for the 'body' if we were sending it.
        // CS-302 says: "DO NOT send installId unless backend truly requires it"
        // So we remove installId from body.

        return apiFetch("/api/saved-scans", {
          method: "POST",
          body: {
            selectedCandidate: candidate,
            confidence: 1.0,
            scanThumb: capturedImage,
            pricing: null
          }
        }).catch(e => console.error("Cloud Save Failed", e));
      })();

      // 4. Background Pricing fetch
      const pricePromise = apiFetch("/api/price", {
        method: "POST",
        body: { seriesTitle, issueNumber, editionId, year },
      }).then(async (resp) => {
        // CS-303: Soft Fail Pricing
        const data = await resp.json();

        // If pricing is available/unavailable (200 OK)
        if (data.ok) {
          setPricingResult(data);

          // Update History with Value
          setHistory(prev => {
            const copy = [...prev];
            const idx = copy.findIndex(i => i.id === snapshotId);
            if (idx !== -1) {
              copy[idx] = { ...copy[idx], value: data.value }; // Merge value
            }
            return copy;
          });
        } else {
          // 200 OK but available: false
          setPricingResult({ value: { typical: null } });
        }
      }).catch(err => {
        // Network fail on pricing - Soft Fail (CS-303)
        console.warn("[Pricing] Failed softly", err);
        setPricingResult({ value: { typical: null } });
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

    // CS-303: Fix ResultCard population
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

    // Use stored value or null placeholder
    setPricingResult(item.value ? { value: item.value } : { value: { typical: null } });
    setState(SCAN_STATE.RESULT);
  }, []);

  // CS-063: Rehydratable Routes (Deep Link Support)
  const loadScanById = useCallback(async (id) => {
    if (!id) return;
    try {
      setState(SCAN_STATE.RESULT);

      const res = await apiFetch(`/api/saved-scans/${id}`);
      if (!res.ok) throw new Error("Scan not found");
      const json = await res.json();
      if (!json.item) throw new Error("Invalid scan data");

      const item = json.item; // Normalized backend response

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
    history,
    identityStatus, // CS-310
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
      clearHistory, // CS-301
      deleteHistoryItem // CS-301
    },
  };
}
