import { apiFetch } from './apiFetch';
import { getDeviceId } from './deviceId';

/**
 * @typedef {Object} IdentifyResponse
 * @property {boolean} ok
 * @property {Array<{editionId: string, seriesTitle: string, issueNumber: string, year: string, publisher: string, coverUrl: string}>} [candidates]
 * @property {string} [error]
 * @property {string} [code]
 */

/**
 * @typedef {Object} PriceResponse
 * @property {boolean} ok
 * @property {Object} [value]
 * @property {number} value.typical
 * @property {number} value.soft
 * @property {number} value.slabs
 * @property {Object} [ebay]
 * @property {string} ebay.imageUrl
 */

/**
 * Backend Freeze Contract Client
 * 
 * STRICTLY enforces the existing API schema.
 * No new modifications to request/response shapes allowed without backend changes.
 */
export const ApiClient = {

    /**
     * Identify a comic from a base64 image.
     * @param {string} base64Image - Raw base64 string (no data: prefix ideally, or backend handles it)
     * @returns {Promise<IdentifyResponse>}
     */
    identify: async (base64Image) => {
        const res = await apiFetch("/api/identify", {
            method: "POST",
            body: { image: base64Image },
            headers: { "x-anon-id": getDeviceId() },
        });
        return res.json();
    },

    /**
     * Get pricing for a specific edition.
     * @param {string} seriesTitle
     * @param {string} issueNumber
     * @param {string} editionId
     * @returns {Promise<PriceResponse>}
     */
    getPricing: async (seriesTitle, issueNumber, editionId) => {
        const res = await apiFetch("/api/price", {
            method: "POST",
            headers: { "x-anon-id": getDeviceId() },
            body: { seriesTitle, issueNumber, editionId },
        });
        return res.json();
    },

    /**
     * Search manually by title and issue.
     * @param {string} title
     * @param {string} issue
     * @returns {Promise<IdentifyResponse>} - Reuses IdentifyResponse shape (candidates)
     */
    search: async (title, issue) => {
        const query = `?title=${encodeURIComponent(title)}&issue=${encodeURIComponent(issue)}`;
        const res = await apiFetch(`/api/search${query}`, {
            method: "GET",
            headers: { "x-anon-id": getDeviceId() }
        });
        return res.json();
    },

    /**
     * Verify IAP receipt.
     * @param {Object} storedPurchase - Platform specific purchase object
     * @returns {Promise<any>}
     */
    verifyEntitlement: async (platform, productId, receipt, purchaseToken) => {
        const res = await apiFetch('/api/entitlements/verify', {
            method: 'POST',
            body: {
                platform,
                productId,
                receipt,
                purchaseToken,
                // deviceId is injected by apiFetch automatically
            }
        });
        return res.json();
    },

    /**
     * Log client-side errors to backend.
     * @param {Object} payload
     */
    logError: async (payload) => {
        try {
            await apiFetch("/api/log", {
                method: "POST",
                body: {
                    ...payload,
                    userAgent: navigator.userAgent
                },
            });
        } catch (e) {
            // Fire and forget, don't throw on log failure
            console.error("Failed to log entry", e);
        }
    }
};
