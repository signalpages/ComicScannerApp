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

            // CS-030: Store Entitlement Locally
            if (data.ok && data.active) {
                // Prevent circular dependency import by using localStorage directly or simple prop
                // For robustness, we should use Preferences if we could, but let's stick to localStorage for speed
                // since IAP bridge is often synchronous-ish or needs simple access
                localStorage.setItem("comicscan_is_paid", "true");
            }

            return data;
        } catch (e) {
            console.error("IAP Verification Failed", e);
            throw e;
        }
    },

    // CS-030: Check Entitlement (Mock/Local Cache)
    isEntitled: async () => {
        // 1. Check Local Cache (Fast)
        const cached = localStorage.getItem("comicscan_is_paid") === "true";
        if (cached) return true;

        // 2. In a real app, we'd check RevenueCat/Store here if cache misses
        // For now, return false
        return false;
    },

    // CS-030: Debug method to clear
    resetEntitlements: () => {
        localStorage.removeItem("comicscan_is_paid");
    }
};
