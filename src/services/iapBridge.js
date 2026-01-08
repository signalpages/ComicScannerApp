
// Bridge for Native IAP (Mock for Web)

export const IAP = {
    // Products
    PRODUCTS: {
        MONTHLY: 'comicscan_pro_monthly',
        YEARLY: 'comicscan_pro_yearly'
    },

    // Initialize Store (Call on app start)
    initialize: async () => {
        console.log("IAP: Initializing...");
        if (window.Capacitor?.isNative) {
            // Native Logic (cordova-plugin-purchase)
            // Register products, setup listeners
        }
    },

    // Trigger Purchase
    purchase: async (productId) => {
        console.log(`IAP: Purchasing ${productId}`);
        if (window.Capacitor?.isNative) {
            // Native Logic
            // Return promise resolving to transaction/receipt
        } else {
            // Web Mock for Demo
            return new Promise((resolve) => {
                setTimeout(() => {
                    const mockReceipt = `mock_receipt_${Date.now()}`;
                    resolve({
                        transactionId: `tx_${Date.now()}`,
                        productId,
                        receipt: mockReceipt
                    });
                }, 1000);
            });
        }
    },

    // Restore Purchases
    restore: async () => {
        console.log("IAP: Restoring...");
        // Native Logic
    },

    // Verify with Backend
    verify: async (purchaseData) => {
        const deviceId = localStorage.getItem('deviceId');
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
