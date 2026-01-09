import { getDeviceId } from '../lib/deviceId';

// Bridge for Native IAP (Mock for Web)

export const IAP = {
    // ...
    // Verify with Backend
    verify: async (purchaseData) => {
        const deviceId = getDeviceId();
        const platform = window.Capacitor?.getPlatform() || 'web';

        try {
            const res = await fetch('/api/entitlements/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId,
                    platform,
                    productId: purchaseData.productId,
                    receipt: purchaseData.receipt || null,
                    purchaseToken: purchaseData.purchaseToken || null
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
