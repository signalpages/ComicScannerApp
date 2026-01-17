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
  const confirmCandidate = useCallback(
    async (candidate) => {
      if (!candidate) return;
      if (inFlight.current) return;
      inFlight.current = true;
      setError(null);

      try {
        setSelectedCandidate(candidate);

        const seriesTitle = candidate.seriesTitle || candidate.displayName || "";
        const issueNumber = candidate.issueNumber || "";
        const editionId = candidate.editionId;

        // CS-017: Remove Pricing Logic - Go straight to RESULT
        // We no longer fetch /api/price.
        setPricingResult({
          status: 'success',
          value: { variants: [] } // Minimal mock so ResultCard doesn't crash on null
        });

        setState(SCAN_STATE.RESULT);

        saveHistory({
          id: crypto.randomUUID(), // CS-020: Unique ID for stable keys
          editionId,
          displayName: candidate.displayName || seriesTitle, // CS-019: Fallback to constructed title
          scanImage: capturedImage, // Persist user scan
          coverUrl: candidate.coverUrl || null,
          marketImageUrl: null,
          year: candidate.year ?? null,
          publisher: candidate.publisher ?? null,
          value: null,
          timestamp: Date.now(),
          // CS-019: Store full candidate info for robust restoration
          candidateSnapshot: {
            seriesTitle,
            issueNumber,
            publisher: candidate.publisher,
            year: candidate.year,
            displayName: candidate.displayName,
            confidence: candidate.confidence,
            is_key_issue: candidate.is_key_issue
          }
        });
      } catch (e) {
        console.error(e);
        setError("Error processing result. Please try again.");
        setState(SCAN_STATE.VERIFY);
      } finally {
        inFlight.current = false;
      }
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
    // CS-020: Restore immutable snapshot
    setCapturedImage(item.scanImage || null);

    // CS-019: Restore robust candidate object
    const restoredCandidate = item.candidateSnapshot || {
      editionId: item.editionId,
      displayName: item.displayName,
      seriesTitle: item.displayName, // fallback
      coverUrl: item.coverUrl ?? null,
      year: item.year ?? null,
      publisher: item.publisher ?? null,
    };

    setSelectedCandidate(restoredCandidate);

    // Ensure pricing result is valid so UI renders
    setPricingResult({
      status: 'success',
      value: { variants: [] }
    });

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
