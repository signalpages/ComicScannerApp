import { useState, useRef, useCallback } from 'react';
import { apiFetch } from '../lib/apiFetch';
// getDeviceId import removed as it's handled by apiFetch now, unless needed for x-anon-id header explicitly
// The previous code used getDeviceId() for x-anon-id header. 
// I should keep getDeviceId import if I need to pass that header, OR I can let apiFetch handle it? 
// User only asked for BODY injection in apiFetch.
// But wait, the previous fix used getDeviceId() for x-anon-id.
// I will keep importing getDeviceId for the header, OR better, I'll rely on the body payload if the backend supports it.
// Actually, I'll keep the import for the header to be safe, but use apiFetch for the request.
import { getDeviceId } from '../lib/deviceId';

// ...

const performIdentification = async (image) => {
    try {
        // apiFetch injects deviceId into body automatically
        const response = await apiFetch('/api/identify', {
            method: 'POST',
            body: JSON.stringify({
                image,
                // deviceId injected by wrapper
            })
        });

        // ... (rest is same)

        // ...

        const response = await apiFetch('/api/price', {
            method: 'POST',
            headers: {
                // Header for quota if needed (preserving existing behavior)
                'x-anon-id': getDeviceId()
            },
            body: JSON.stringify({
                seriesTitle,
                issueNumber,
                editionId: candidate.editionId
                // deviceId injected by wrapper
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
