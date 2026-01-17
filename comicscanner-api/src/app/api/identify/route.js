import { z } from "zod";
import crypto from "crypto";
import { redis } from "@/lib/redis";
import { requireAnonId, enforceMonthlyQuota } from "@/lib/quota";
import { getVisionProvider } from "@/lib/vision/factory";

const Body = z.object({
    image: z.string().min(10),
});

function hashImage(base64) {
    return crypto.createHash("sha256").update(base64).digest("hex");
}

export async function POST(req) {
    // 1. Auth Check (Always required)
    const anonRes = await requireAnonId(req);
    if (!anonRes.ok) return Response.json(anonRes.body, { status: anonRes.status });

    // 2. Parse Body & Hash Image (Before Quota)
    let json;
    try {
        json = await req.json();
    } catch {
        return Response.json({ ok: false, code: "BAD_JSON", error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = Body.safeParse(json);
    if (!parsed.success) {
        return Response.json({ ok: false, code: "BAD_REQUEST", error: "Missing image data" }, { status: 400 });
    }

    const imageHash = hashImage(parsed.data.image);
    const cacheKey = `identify:${imageHash}`;

    // 3. Cache Lookup
    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            console.log(`[METRICS] type=cache status=hit key=${imageHash.substring(0, 8)}`);
            // Return cached result - bypass quota!
            return Response.json({
                ok: true,
                candidates: cached,
                cached: true
            });
        }
        console.log(`[METRICS] type=cache status=miss key=${imageHash.substring(0, 8)}`);
    } catch (e) {
        console.warn("Redis Error:", e);
    }

    // 4. Quota Check (Only on Cache Miss)
    const quota = await enforceMonthlyQuota(anonRes.anon);
    if (!quota.ok) {
        console.log(`[QUOTA EXCEEDED] ${anonRes.anon}`);
        // Soft failure: Return 200 OK with NO_MATCH/QUOTA code so client falls back to manual search
        return Response.json({
            ok: true,
            code: "QUOTA_EXCEEDED",
            candidates: []
        }, { status: 200 });
    }

    // 5. Vision Identification
    try {
        const provider = getVisionProvider();
        const candidates = await provider.identify(parsed.data.image);

        // 6. Store in Cache (if valid match found)
        if (candidates.length > 0) {
            // Cache for 30 days
            await redis.set(cacheKey, candidates, { ex: 60 * 60 * 24 * 30 });
        }

        return Response.json({
            ok: true,
            candidates
        });

    } catch (error) {
        console.error("Vision Error:", error);
        return Response.json({
            ok: true,
            code: "VISION_ERROR",
            candidates: []
        });
    }
}
