
import { redis } from '../../_services/redis.js';

export const runtime = 'nodejs';

export async function POST(request) {
    try {
        const body = await request.json();
        const { deviceId, platform, productId, receipt, purchaseToken } = body;

        if (!deviceId || !productId || !platform) {
            return Response.json({ ok: false, error: "Missing fields" }, { status: 400 });
        }

        const isValid = !!(receipt || purchaseToken);
        if (!isValid) {
            return Response.json({ ok: false, error: "Invalid receipt" }, { status: 400 });
        }

        if (process.env.UPSTASH_REDIS_REST_URL) {
            const entitlementKey = `entitlement:${deviceId}`;
            const now = Date.now();
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
            const ttl = Math.ceil(duration / 1000) + 86400;
            await redis.expire(entitlementKey, ttl);

            return Response.json({
                ok: true,
                entitled: true,
                expiresAt
            });
        }

        return Response.json({ ok: true, entitled: true, mock: true });

    } catch (e) {
        console.error("Verification Error", e);
        return Response.json({ ok: false, error: e.message }, { status: 500 });
    }
}
