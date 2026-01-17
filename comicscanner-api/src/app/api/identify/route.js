import { z } from "zod";
import OpenAI from "openai";
import crypto from "crypto";
import { redis } from "@/lib/redis";
import { requireAnonId, enforceMonthlyQuota } from "@/lib/quota";

const openai = new OpenAI();

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
            console.log(`[CACHE HIT] ${imageHash}`);
            // Return cached result - bypass quota!
            return Response.json({
                ok: true,
                candidates: cached,
                cached: true
            });
        }
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
        // ... (OpenAI Logic) ...
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are a comic book expert. Identify the comic from the image. Return JSON ONLY: { \"seriesTitle\": string, \"issueNumber\": string, \"publisher\": string, \"year\": numberOrNull }. If uncertain, return null fields."
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Identify this comic." },
                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${parsed.data.image}` } }
                    ]
                }
            ],
            response_format: { type: "json_object" },
            max_tokens: 300,
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) throw new Error("No content from OpenAI");

        const result = JSON.parse(content);

        const candidate = {
            seriesTitle: result.seriesTitle || null,
            issueNumber: result.issueNumber ? String(result.issueNumber) : null,
            publisher: result.publisher || null,
            year: result.year || null,
            confidence: 1.0
        };

        const candidates = candidate.seriesTitle ? [candidate] : [];

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
