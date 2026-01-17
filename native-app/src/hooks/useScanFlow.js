import { useState, useRef, useCallback } from "react";
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
  // History helpers
  // -------------------------
  const saveHistory = useCallback((item) => {
    try {
      const history = JSON.parse(localStorage.getItem("scanHistory") || "[]");
      const newHistory = [item, ...history].slice(0, 10);
      localStorage.setItem("scanHistory", JSON.stringify(newHistory));
    } catch (e) {
      console.error("History save failed", e);
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

    // ✅ also clear capture guard
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
        headers: { "x-anon-id": getDeviceId() },
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

  // ✅ REPLACE your captureImage with this guarded version
  const captureImage = useCallback(
    (base64Image) => {
      const now = Date.now();

      // hard stop: double event (touch + click), accidental double tap, etc.
      if (captureLockRef.current) return;
      if (now - lastCaptureTsRef.current < 650) return;

      captureLockRef.current = true;
      lastCaptureTsRef.current = now;

      console.log("captureImage: triggered");
      clearError();

      setCapturedImage(base64Image);
      // ✅ FIX: Set state to IDENTIFYING so App.jsx shows spinner instead of empty VerifyView
      setState(SCAN_STATE.IDENTIFYING);

      // Call identify once
      performIdentification(base64Image);

      // release lock shortly after to allow next legit capture
      setTimeout(() => {
        captureLockRef.current = false;
      }, 400);
    },
    [clearError, performIdentification]
  );

  // -------------------------
  // Candidate → Pricing
  // -------------------------
  // -------------------------
  // Candidate → Pricing (Non-Blocking Port + CS-033)
  // -------------------------
  const confirmCandidate = useCallback(
    async (candidate) => {
      if (!candidate) return;
      // Note: We don't block UI with inFlight here to allow immediate transition
      setError(null);

      // CS-026: Normalized Data
      const seriesTitle = candidate.seriesTitle || candidate.displayName || "";
      const issueNumber = candidate.issueNumber || "";
      const editionId = candidate.editionId;
      const year = candidate.year || null;

      // 1. Immediate UI Transition (CS-025)
      setSelectedCandidate(candidate);
      setPricingResult(null); // Loading state
      setState(SCAN_STATE.RESULT);

      // 2. Create Initial Snapshot (CS-033)
      const scanId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
      const initialSnapshot = {
        id: scanId,
        timestamp: Date.now(),
        // CS-033: Flattened, self-contained data
        displayName: candidate.displayName, // Single source of truth for UI
        subtitle: `${candidate.publisher || 'Unknown'} • ${year || '—'}`,
        scanImage: capturedImage,
        coverUrl: candidate.coverUrl || null,
        identifiers: {
          seriesTitle,
          issueNumber,
          editionId,
          publisher: candidate.publisher,
          year
        },
        // Pricing initially null
        value: null,
        pricing: null
      };

      // Save immediately so it appears in history
      saveHistory(initialSnapshot);

      // 3. Background Pricing Fetch (CS-025 + CS-027)
      apiFetch("/api/price", {
        method: "POST",
        headers: { "x-anon-id": getDeviceId() },
        body: { seriesTitle, issueNumber, editionId, year }, // CS-027: Pass year
      })
        .then(async (resp) => {
          const data = await resp.json();
          if (data.ok) {
            setPricingResult(data);

            // Update History with Price (CS-033)
            // We need to read-modify-write. 
            // Note: In a real hooks flow this is race-condition prone without a reducer, 
            // but effective for this scale.
            try {
              const history = JSON.parse(localStorage.getItem("scanHistory") || "[]");
              const idx = history.findIndex(h => h.id === scanId);
              if (idx !== -1) {
                history[idx].value = data.value;
                history[idx].pricing = data; // Full debug info
                history[idx].marketImageUrl = data.ebay?.imageUrl; // Fallback image
                localStorage.setItem("scanHistory", JSON.stringify(history));
              }
            } catch (e) {
              console.error("History update failed", e);
            }
          } else {
            // Silently fail to "Unavailable" (CS-025)
            setPricingResult({ value: { typical: null } });
          }
        })
        .catch(e => {
          console.warn("Background pricing failed", e);
          setPricingResult({ value: { typical: null } });
        });

    },
    [saveHistory, capturedImage]
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
        { method: "GET", headers: { "x-anon-id": getDeviceId() } }
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
    setCapturedImage(item.scanImage || null); // Restore scan image

    setSelectedCandidate({
      editionId: item.editionId,
      displayName: item.displayName,
      coverUrl: item.coverUrl ?? null,
      marketImageUrl: item.marketImageUrl ?? null,
      year: item.year ?? null,
      publisher: item.publisher ?? null,
    });

    setPricingResult({ ok: true, editionId: item.editionId, value: item.value, comps: [] });
    setState(SCAN_STATE.RESULT);
  }, []);

  return {
    state,
    error,
    capturedImage,
    candidates,
    selectedCandidate,
    pricingResult,
    quotaStatus,
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
      openSettings,
    },
  };
}
