import { getDeviceId } from './deviceId';
import { Capacitor } from '@capacitor/core';

/**
 * Wrapper around fetch to ensure deviceId is always included in POST bodies.
 * @param {string} url 
 * @param {object} options 
 * @returns {Promise<Response>}
 */
export const apiFetch = async (url, options = {}) => {
    const defaultHeaders = {
        'Content-Type': 'application/json'
    };


    // --------------------------------------------------------
    // ✅ CRITICAL FIX: Detect Native Runtime & Use Prod URL
    // --------------------------------------------------------
    const isNative = Capacitor.isNativePlatform();
    // Vercel URL hidden from UI, used ONLY internally in native environment
    const PROD_API_BASE = "https://comicscanner-api.vercel.app";

    // If native (Android/iOS), force full URL. Otherwise use relative (proxy).
    let finalUrl = url;
    if (isNative && url.startsWith('/')) {
        finalUrl = `${PROD_API_BASE}${url}`;
    }

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
            // Header Dev Bypass (only works in non-production)
            ...(process.env.NODE_ENV !== 'production' ? { "x-dev-bypass": "1" } : {})
        }
    };

    // Auto-inject deviceId for POST requests
    if (config.method === 'POST' && config.headers['Content-Type'] === 'application/json') {
        let body = {};
        if (config.body) {
            try {
                body = typeof config.body === 'string' ? JSON.parse(config.body) : config.body;
            } catch (e) {
                console.warn('apiFetch: parsing body failed', e);
                body = config.body;
            }
        }

        // If body turned out to be an object (or we successfully parsed it)
        if (typeof body === 'object' && body !== null) {
            const deviceId = getDeviceId();

            // Inject distinct device IDs
            body.deviceId = deviceId;
            body.device_id = deviceId; // snake_case backup

            config.body = JSON.stringify(body);
        }
    }

    if (isNative) {
        console.log(`[API REQUEST] ${url} (Resolved internally)`);
    }

    let response;
    try {
        response = await fetch(finalUrl, config);
    } catch (netError) {
        // Network failure (offline, DNS, etc.)
        if (isNative) console.error(`[API NETWORK ERROR] ${netError.message}`);
        throw new Error("Network error. Please check your connection.");
    }

    // --------------------------------------------------------
    // ✅ CRITICAL FIX: Safe Response Handling (No HTML Crashes)
    // --------------------------------------------------------
    const contentType = response.headers.get("content-type") || "";

    // 1. Check fail conditions
    if (!response.ok || !contentType.includes("application/json")) {
        let errorSnippet = "";
        try {
            const text = await response.text();
            errorSnippet = text.slice(0, 200);
        } catch (e) { errorSnippet = "[Read Failed]"; }

        if (isNative) {
            console.error(`[API ERROR] Status: ${response.status} | Type: ${contentType}`);
            // Log snippet only to console, NEVER expose to UI
            console.error(`[API ERROR SNIPPET] ${errorSnippet}`);
        }

        // Generic user-safe message
        throw new Error("Service temporarily unavailable. Please try again.");
    }

    // 2. If valid JSON, return response (caller expects to call .json())
    return response;
};
