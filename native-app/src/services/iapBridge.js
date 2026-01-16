import { apiFetch } from '../lib/apiFetch';

// Bridge for Native IAP (Mock for Web)

export const IAP = {
    // ...
    // Verify with Backend
    verify: async (purchaseData) => {
        const platform = window.Capacitor?.getPlatform() || 'web';

        try {
            const res = await apiFetch('/api/entitlements/verify', {
                method: 'POST',
                body: JSON.stringify({
                    platform,
                    productId: purchaseData.productId,
                    receipt: purchaseData.receipt || null,
                    purchaseToken: purchaseData.purchaseToken || null
                    // deviceId auto-injected
                })
            });
            const data = await res.json();
            return data;
        } catch (e) {
            console.error("IAP Verification Failed", e);
            throw e;
        }
    }
};
