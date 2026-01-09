import { useState, useRef, useCallback } from "react";
import { apiFetch } from "../lib/apiFetch";
import { getDeviceId } from "../lib/deviceId";

// If you already have this enum elsewhere, keep yours and delete this.
export const SCAN_STATE = {
  HOME: "HOME",
  CAMERA: "CAMERA",
  VERIFY: "VERIFY",
  RESULT: "RESULT",
  MANUAL_SEARCH: "MANUAL_SEARCH",
};

export function useScanFlow() {
  const [state, setState] = useState(SCAN_STATE.HOME);
  const [error, setError] = useState(null);

  const [capturedImage, setCapturedImage] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [pricingResult, setPricingResult] = useState(null);

  const inFlight = useRef(false);

  // -------------------------
  // History helpers (define BEFORE use)
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
    setState(SCAN_STATE.HOME);
    inFlight.current = false;
  }, []);

  const clearError = useCallback(() => setError(null), []);

  // TODO: wire your real camera start/capture
  const startCamera = useCallback(() => {
    clearError();
    setState(SCAN_STATE.CAMERA);
  }, [clearError]);

  // -------------------------
  // Identification → Candidates
  // -------------------------
  const performIdentification = useCallback(
    async (image) => {
      console.log('performIdentification: calling API with image length', image?.length);
      if (inFlight.current) {
        console.log('performIdentification: skipped (inFlight)');
        return;
      }
      inFlight.current = true;
      setError(null);

      try {
        const resp = await apiFetch("/api/identify", {
          method: "POST",
          // apiFetch will inject { device_id, ... }
          body: { image },
          // If your backend uses this for quotas, keep it:
          headers: { "x-anon-id": getDeviceId() },
        });

        const data = await resp.json();
        console.log('performIdentification: candidates received', data.candidates?.length);

        if (!data?.ok) {
          throw new Error(data?.error || "Identification failed");
        }

        setCandidates(data.candidates || []);
        setSelectedCandidate(null);
        setPricingResult(null);
        // Note: verify state is set in captureImage too, but safe to set again or here logic-wise
        setState(SCAN_STATE.VERIFY);
      } catch (e) {
        console.error('performIdentification error', e);
        setError(e?.message || "Identification failed. Please try again.");
        setState(SCAN_STATE.HOME);
      } finally {
        inFlight.current = false;
      }
    },
    []
  );

  const captureImage = useCallback((base64Image) => {
    console.log('captureImage: triggered');
    clearError();
    setCapturedImage(base64Image);
    // Directly trigger identification as requested
    // Set state to verify to show UI (candidates will populate when ready)
    setState(SCAN_STATE.VERIFY);
    performIdentification(base64Image);
  }, [clearError, performIdentification]);

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

        const resp = await apiFetch("/api/price", {
          method: "POST",
          headers: {
            // preserve existing quota behavior if backend expects it
            "x-anon-id": getDeviceId(),
          },
          // IMPORTANT: pass an object; apiFetch will JSON.stringify and inject device_id
          body: {
            seriesTitle,
            issueNumber,
            editionId,
          },
        });

        const data = await resp.json();

        if (!data?.ok) {
          throw new Error(data?.error || "Pricing failed");
        }

        setPricingResult(data);
        setState(SCAN_STATE.RESULT);

        saveHistory({
          editionId,
          displayName: candidate.displayName,
          // coverUrl may be null now; fine.
          coverUrl: candidate.coverUrl ?? null,
          year: candidate.year ?? null,
          publisher: candidate.publisher ?? null,
          value: data.value,
          timestamp: Date.now(),
        });
      } catch (e) {
        console.error(e);
        setError("Pricing failed. Please try again.");
        // REQUIRED: unblock user
        setState(SCAN_STATE.VERIFY);
      } finally {
        inFlight.current = false;
      }
    },
    [saveHistory]
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
      // Use apiFetch so device_id is injected consistently
      const resp = await apiFetch(
        `/api/search?title=${encodeURIComponent(title)}&issue=${encodeURIComponent(
          issue
        )}`,
        {
          method: "GET",
          headers: { "x-anon-id": getDeviceId() },
        }
      );

      const data = await resp.json();

      if (!data?.ok) throw new Error(data?.error || "Search failed");

      setCandidates(data.candidates || []);
      setSelectedCandidate(null);
      setPricingResult(null);

      // Always verify manual search
      setState(SCAN_STATE.VERIFY);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Search failed. Please try again.");
    } finally {
      inFlight.current = false;
    }
  }, []);

  const openHistoryItem = useCallback((item) => {
    setSelectedCandidate({
      editionId: item.editionId,
      displayName: item.displayName,
      coverUrl: item.coverUrl ?? null,
      year: item.year ?? null,
      publisher: item.publisher ?? null,
    });

    setPricingResult({
      ok: true,
      editionId: item.editionId,
      value: item.value,
      comps: [],
    });

    setState(SCAN_STATE.RESULT);
  }, []);

  // -------------------------
  // Public API (THIS is where your extra `};` happened before)
  // -------------------------
  return {
    state,
    error,
    capturedImage,
    candidates,
    selectedCandidate,
    pricingResult,
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
    },
  };
}
