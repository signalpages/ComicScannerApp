
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

    const performIdentification = async (image) => {
        try {
            const response = await fetch('/api/identify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image })
            });

            if (!response.ok) throw new Error('Identification failed');

            const data = await response.json();
            if (!data.ok) throw new Error(data.error || 'Unknown error');

            setCandidates(data.candidates || []);

            // Auto-select logic if low risk
            if (data.variantRisk === 'LOW' && data.candidates?.length === 1) {
                confirmCandidate(data.candidates[0]);
            } else {
                inFlight.current = false; // Allow interaction
                setState(SCAN_STATE.VERIFY);
            }

        } catch (e) {
            console.error(e);
            setError(e.message);
            inFlight.current = false;
            // Go back to Home or Error state?
            setState(SCAN_STATE.HOME); // Or stay in identify with error
        }
    };

    const confirmCandidate = useCallback((candidate) => {
        setSelectedCandidate(candidate);
        setState(SCAN_STATE.PRICING);
        fetchPricing(candidate.editionId);
    }, []);

    const fetchPricing = async (editionId) => {
        try {
            // Check Quota logic handles in API
            const response = await fetch('/api/price', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ editionId })
            });

            const data = await response.json();
            // Pricing might return ok:true but with masked values if quota exceeded

            setPricingResult(data);
            setState(SCAN_STATE.RESULT);

            // Save History
            saveHistory({
                editionId,
                displayName: selectedCandidate?.displayName || 'Comic',
                coverUrl: selectedCandidate?.coverUrl,
                value: data.value,
                timestamp: Date.now()
            });

        } catch (e) {
            setError('Pricing failed');
            // Allow retry?
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
