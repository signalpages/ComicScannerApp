import { redis } from '../_services/redis.js';

export const config = {
    runtime: 'edge',
};

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

    try {
        const body = req.body || {};
        const { deviceId, platform, productId, receipt, purchaseToken } = body;

        if (!deviceId || !productId || !platform) {
            return res.status(400).json({ ok: false, error: "Missing fields" });
        }

        // --- VERIFICATION LOGIC (MOCK FOR V1) ---
        // In production, validate 'receipt' (iOS) or 'purchaseToken' (Android) 
        // with Apple/Google servers using Service Account/Shared Secret.
        // For now, we trust the client's assertion (Development mode) 
        // OR simply validate presence.

        const isValid = !!(receipt || purchaseToken);

        if (!isValid) {
            return res.status(400).json({ ok: false, error: "Invalid receipt" });
        }

        // --- UPDATE ENTITLEMENT IN REDIS ---
        if (process.env.UPSTASH_REDIS_REST_URL) {
            const entitlementKey = `entitlement:${deviceId}`;
            const now = Date.now();
            // Monthly = 30 days, Yearly = 365 days
            const duration = productId.includes('yearly') ? 31536000000 : 2592000000;
            const expiresAt = now + duration;

            const entitlementData = {
                entitled: true,
                productId,
                platform,
                expiresAt,
                updatedAt: now
            };

            await redis.set(entitlementKey, JSON.stringify(entitlementData));
            // Set TTL slightly longer than expiration
            const ttl = Math.ceil(duration / 1000) + 86400; // +1 day buffer
            await redis.expire(entitlementKey, ttl);

            return res.status(200).json({
                ok: true,
                entitled: true,
                expiresAt
            });
        }

        // Fallback if no Redis configured
        return res.status(200).json({ ok: true, entitled: true, mock: true });

    } catch (e) {
        console.error("Verification Error", e);
        return res.status(500).json({ ok: false, error: e.message });
    }
}
