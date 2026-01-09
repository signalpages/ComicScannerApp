
import { useState, useRef, useCallback } from 'react';

// Explicit States
export const SCAN_STATE = {
    HOME: 'HOME',
    CAMERA: 'CAMERA',
    CAPTURED: 'CAPTURED', // Intermediate state to ensure unmount
    IDENTIFYING: 'IDENTIFYING',
    VERIFY: 'VERIFY',
    PRICING: 'PRICING',
    RESULT: 'RESULT',
    MANUAL_SEARCH: 'MANUAL_SEARCH'
};

export const useScanFlow = () => {
    const [state, setState] = useState(SCAN_STATE.HOME);
    const [error, setError] = useState(null);
    const [capturedImage, setCapturedImage] = useState(null); // Base64
    const [candidates, setCandidates] = useState([]);
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [pricingResult, setPricingResult] = useState(null);

    // Safety ref to prevent double-fires
    const inFlight = useRef(false);

    const resetFlow = useCallback(() => {
        setState(SCAN_STATE.HOME);
        setError(null);
        setCapturedImage(null);
        setCandidates([]);
        setSelectedCandidate(null);
        setPricingResult(null);
        inFlight.current = false;
    }, []);

    const startCamera = useCallback(() => {
        resetFlow();
        setState(SCAN_STATE.CAMERA);
    }, [resetFlow]);

    const captureImage = useCallback(async (base64Image) => {
        if (inFlight.current) return;
        inFlight.current = true;

        setCapturedImage(base64Image);
        setState(SCAN_STATE.CAPTURED); // Forces Camera Unmount

        // Slight delay to allow UI to update (unmount camera)
        setTimeout(() => {
            setState(SCAN_STATE.IDENTIFYING);
            performIdentification(base64Image);
        }, 100);
    }, []);

    // Helper: Device ID
    const getDeviceId = () => {
        let id = localStorage.getItem('deviceId');
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem('deviceId', id);
        }
        return id;
    };

    const performIdentification = async (image) => {
        try {
            const response = await fetch('/api/identify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image,
                    deviceId: getDeviceId()
                })
            });

            if (response.status === 402) {
                // Quota Exceeded
                const errData = await response.json();
                // Throw specific error to be caught below
                throw new Error('SCAN_LIMIT_REACHED');
            }

            if (!response.ok) throw new Error('Identification failed');

            const data = await response.json();
            if (!data.ok) throw new Error(data.error || 'Unknown error');

            // data.best contains strict schema { seriesTitle, issueNumber, ... }
            const best = data.best;
            const safeIssue =
                best.issueNumber !== null &&
                    best.issueNumber !== undefined &&
                    /^\d+$/.test(String(best.issueNumber))
                    ? String(best.issueNumber)
                    : null;

            const candidate = {
                editionId: safeIssue
                    ? `auto-${best.seriesTitle}-${safeIssue}`
                    : `auto-${best.seriesTitle}`,

                seriesTitle: best.seriesTitle,
                issueNumber: safeIssue,

                displayName: safeIssue
                    ? `${best.seriesTitle} #${safeIssue}`
                    : best.seriesTitle,

                year: best.year || null,
                publisher: best.publisher || null,

                coverUrl: null, // Identify step does not fetch covers
                confidence: best.confidence
            };

            setCandidates([candidate]);

            // STRICT Commercial logic: 
            // - If confidence < 0.6, Verify is mandatory.
            // - "No auto-accept" is the instruction, so Verify is ALWAYS mandatory?
            // "If confidence < 0.6, Verify is mandatory ... No auto-accept"
            // Implies we ALWAYS verify.

            inFlight.current = false;
            setState(SCAN_STATE.VERIFY);

        } catch (e) {
            console.error(e);
            setError(e.message);
            inFlight.current = false;
            setState(SCAN_STATE.HOME);
        }
    };

    const confirmCandidate = useCallback((candidate) => {
        setSelectedCandidate(candidate);
        setState(SCAN_STATE.PRICING);
        // Pass candidate object so we can extract title/issue for Price API
        fetchPricing(candidate);
    }, []);

    const fetchPricing = async (candidate) => {
        try {
            // Extract necessary fields for Price API
            // It expects { seriesTitle, issueNumber } OR editionId
            const seriesTitle = candidate.seriesTitle || candidate.displayName;
            const issueNumber =
                candidate.issueNumber && /^\d+$/.test(candidate.issueNumber)
                    ? candidate.issueNumber
                    : null;

            body: JSON.stringify({
                seriesTitle,
                issueNumber,
                editionId: candidate.editionId
            })

            // REQUIRED GUARD: Missing Title
            if (!seriesTitle || seriesTitle === 'Unknown') {
                setError('Could not identify title. Try Manual Search.');
                setState(SCAN_STATE.VERIFY); // Allow recovery
                return;
            }

            const response = await fetch('/api/price', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Header for quota if needed
                    'x-anon-id': getDeviceId()
                },
                body: JSON.stringify({
                    seriesTitle,
                    issueNumber,
                    editionId: candidate.editionId
                })
            });

            const data = await response.json();

            setPricingResult(data);
            setState(SCAN_STATE.RESULT);

            saveHistory({
                editionId: candidate.editionId,
                displayName: candidate.displayName,
                coverUrl: candidate.coverUrl,
                value: data.value,
                timestamp: Date.now()
            });

        } catch (e) {
            console.error(e);
            setError('Pricing failed. Please try again.');
            setState(SCAN_STATE.VERIFY); // REQUIRED: Unblock user
        } finally {
            inFlight.current = false;
        }
    };

    // Manual Flow
    const startManualSearch = useCallback(() => {
        resetFlow();
        setState(SCAN_STATE.MANUAL_SEARCH);
    }, [resetFlow]);

    const performManualSearch = async (title, issue) => {
        if (inFlight.current) return;
        inFlight.current = true;
        setError(null);

        try {
            const response = await fetch(`/api/search?title=${encodeURIComponent(title)}&issue=${encodeURIComponent(issue)}`);
            const data = await response.json();

            if (!data.ok) throw new Error(data.error || 'Search failed');

            setCandidates(data.candidates || []);
            setState(SCAN_STATE.VERIFY); // Always verify manual search

        } catch (e) {
            setError(e.message);
        } finally {
            inFlight.current = false;
        }
    };

    const clearError = useCallback(() => setError(null), []);

    const openHistoryItem = useCallback((item) => {
        setSelectedCandidate({
            editionId: item.editionId,
            displayName: item.displayName,
            coverUrl: item.coverUrl,
            year: item.year, // Ensure history saver includes this if possible
            publisher: item.publisher
        });

        setPricingResult({
            ok: true,
            editionId: item.editionId,
            value: item.value,
            comps: []
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
        actions: {
            startCamera,
            captureImage,
            confirmCandidate,
            startManualSearch,
            performManualSearch,
            resetFlow,
            clearError,
            openHistoryItem
        }
    };
};

// Helper for History
const saveHistory = (item) => {
    try {
        const history = JSON.parse(localStorage.getItem('scanHistory') || '[]');
        const newHistory = [item, ...history].slice(0, 10);
        localStorage.setItem('scanHistory', JSON.stringify(newHistory));
    } catch (e) {
        console.error('History save failed', e);
    }
};
