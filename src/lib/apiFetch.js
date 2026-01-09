import { getDeviceId } from './deviceId';

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
                // If parsing fails, use original body (might be non-JSON, though header says otherwise)
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

    return fetch(url, config);
};
