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

    // CS-030: Check Entitlement Header
    const isPaid = req.headers.get("x-entitlement-status") === "active";

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

    // CS-055: Image Normalization
    let cleanImage = parsed.data.image;

    // Check for data URI prefix
    const dataUriMatch = cleanImage.match(/^data:image\/([a-zA-Z+]+);base64,/);
    if (dataUriMatch) {
        const mime = dataUriMatch[1].toLowerCase();
        // OpenAI supports: jpeg, jpg, png, webp, non-animated gif
        // We reject sensitive formats or unknown ones
        if (['heic', 'heif', 'tiff', 'bmp'].includes(mime)) {
            console.log(`[IDENTIFY] Unsupported MIME: ${mime}`);
            return Response.json({ ok: true, candidates: [], code: "NO_MATCH" }); // Soft fail
        }
        // Strip prefix for processing/hashing if strictly raw base64 needed, 
        // BUT OpenAI usually accepts Data URL if passed as `type: "image_url", image_url: { url: ... }`
        // Our provider likely constructs this.
        // If provider expects raw base64, we strip.
        // Let's assume provider expects raw base64 or handles it.
        // Actually, "hashImage" calculates hash. If we strip prefix, hash changes.
        // Let's keep consistency:

        // If we want to standardise, we usually pass Data URI to OpenAI.
        // But hash should be consistent.
    } else {
        // No prefix? Assume JPEG if just raw base64, usually safe.
        // But verify it's base64-ish? 
        if (cleanImage.length < 100) return Response.json({ ok: false, code: "BAD_IMAGE" }, { status: 400 });

        // Auto-prefix if missing? OpenAI prefers Data URI for base64 inputs.
        // Let's append if completely missing, assuming jpeg.
        cleanImage = `data:image/jpeg;base64,${cleanImage}`;
    }

    const imageHash = hashImage(cleanImage);
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
    // CS-030: Pass isPaid flag
    const quota = await enforceMonthlyQuota(anonRes.anon, isPaid);
    if (!quota.ok) {
        console.log(`[QUOTA EXCEEDED] ${anonRes.anon}`);
        // Soft failure: Return 200 OK with SCAN_LIMIT_REACHED code so client shows Paywall
        return Response.json({
            ok: false,
            code: "SCAN_LIMIT_REACHED",
            error: "Monthly limit reached",
            used: quota.used,
            limit: quota.limit,
            remaining: quota.remaining,
            plan: "free", // Implicitly free plan
            candidates: []
        }, { status: 200 });
    }

    // 5. Vision Identification
    try {
        const provider = getVisionProvider();
        const candidates = await provider.identify(cleanImage);

        // 6. Store in Cache (if valid match found)
        if (candidates.length > 0) {
            // Cache for 30 days
            await redis.set(cacheKey, candidates, { ex: 60 * 60 * 24 * 30 });
        }

        return Response.json({
            ok: true,
            candidates,
            backendVersion: process.env.VERCEL_GIT_COMMIT_SHA || "dev"
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
