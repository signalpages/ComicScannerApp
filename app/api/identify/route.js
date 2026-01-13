
import { redis } from '../_services/redis.js';
import { Ratelimit } from "@upstash/ratelimit";

const ratelimit = new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(10, "60 s"), // 10 scans per minute per IP
});

export const runtime = 'nodejs'; // Use nodejs for OpenAI client capabilities if needed

const extractBase64 = (input) => {
    if (typeof input === 'string') return input.replace(/^data:image\/\w+;base64,/, '').trim();
    if (input && typeof input === 'object') {
        if (typeof input.base64 === 'string') return input.base64.trim();
    }
    return null;
};

//bypass limits for testing
const isDevBypass = (request) => {
    // Never allow bypass in production
    if (process.env.NODE_ENV === "production") return false;

    // Explicit header opt-in
    if (request.headers.get("x-dev-bypass") === "1") return true;

    return false;
};


export async function POST(request) {
    try {
        const body = await request.json();
        const base64Data = extractBase64(body.image);
        const deviceId = body.deviceId;

        if (!base64Data) {
            return Response.json({ ok: false, error: 'No image data provided' }, { status: 400 });
        }
        if (!deviceId) {
            return Response.json({ ok: false, error: "missing_device_id" }, { status: 400 });
        }

        // --- QUOTA LOGIC ---
        //if (process.env.UPSTASH_REDIS_REST_URL) {
        const devBypass = isDevBypass(request);

        if (process.env.UPSTASH_REDIS_REST_URL && !devBypass) {
            // DOS Protection (IP Rate Limit)
            const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
            const { success } = await ratelimit.limit(ip);
            if (!success) {
                return Response.json({ ok: false, error: "Too many requests. Please slow down." }, { status: 429 });
            }

            // Check Entitlement

            // Check Entitlement
            const entitlementKey = `entitlement:${deviceId}`;
            const entitlementRaw = await redis.get(entitlementKey);
            let isEntitled = false;

            if (entitlementRaw) {
                try {
                    const ent = (typeof entitlementRaw === 'string') ? JSON.parse(entitlementRaw) : entitlementRaw;
                    if (ent.entitled && ent.expiresAt > Date.now()) {
                        isEntitled = true;
                    }
                } catch (e) { console.error("Entitlement Parse Error", e); }
            }

            if (!isEntitled) {
                const date = new Date();
                const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                const redisKey = `scan:${deviceId}:${monthKey}`;

                const usedCount = (await redis.get(redisKey)) || 0;
                const used = parseInt(usedCount, 10);
                const limit = 5;

                if (used >= limit) {
                    // Calculate next month reset date (1st of next month)
                    const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);

                    return Response.json({
                        ok: false,
                        error: "LIMIT_REACHED",
                        message: "You’ve used all 5 free scans for this month.",
                        plan: "FREE",
                        limit: 5,
                        used: used,
                        remaining: 0,
                        resetAt: nextMonth.toISOString()
                    }, { status: 429 });
                }
            }
        }

        if (!process.env.OPENAI_API_KEY) {
            return Response.json({ ok: false, error: "Missing OPENAI_API_KEY" }, { status: 500 });
        }

        // Call OpenAI
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: `You are identifying a photographed comic book cover.
Extract ONLY what is visible on the cover.
Do NOT guess issue numbers, years, or variants.
If information is unclear, return null and lower confidence.

Return valid JSON ONLY with this schema:

{
  "seriesTitle": string | null,
  "issueNumber": string | null,
  "publisher": string | null,
  "year": number | null,
  "variantHints": string[],
  "confidence": number
}

Rules:
- issueNumber must be numeric or numeric+suffix (e.g. "36", "1A")
- confidence is between 0.0 and 1.0`
                    },
                    {
                        role: "user",
                        content: [
                            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Data}` } }
                        ]
                    }
                ],
                response_format: { type: "json_object" },
                temperature: 0.0
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            console.error("OpenAI Error", err);
            return Response.json({ ok: false, error: "AI Provider Error" }, { status: 502 });
        }

        const aiDataJSON = await response.json();
        const content = aiDataJSON.choices?.[0]?.message?.content;

        let aiResult = null;
        let parseMethod = "strict";

        // 1. Strict Parse
        try {
            aiResult = JSON.parse(content);
        } catch (e) {
            // 2. Loose: Markdown Strip
            try {
                const clean = content.replace(/```json\n?|\n?```/g, "").trim();
                aiResult = JSON.parse(clean);
                parseMethod = "clean_markdown";
            } catch (e2) {
                // 3. Fallback: Regex Regex
                console.warn("JSON Parse Failed, attempting Regex fallback", content);
                const titleMatch = content.match(/"seriesTitle":\s*"([^"]+)"/);
                const issueMatch = content.match(/"issueNumber":\s*"([^"]+)"/);

                if (titleMatch) {
                    aiResult = {
                        seriesTitle: titleMatch[1],
                        issueNumber: issueMatch ? issueMatch[1] : null,
                        publisher: null,
                        year: null,
                        confidence: 0.5 // Penalty for bad format
                    };
                    parseMethod = "regex_fallback";
                }
            }
        }

        if (!aiResult || !aiResult.seriesTitle) {
            console.error("Identify Failed: No Title Found", content);
            return Response.json({
                ok: false,
                error: "Could not identify comic. Try moving closer.",
                debug_raw: content ? content.substring(0, 100) : "null"
            }, { status: 200 }); // Return 200 with ok:false to handle gracefully
        }

        // Determine Variant Risk
        let variantRisk = "LOW";
        if (aiResult.variantHints && aiResult.variantHints.length > 0) variantRisk = "HIGH";
        if (aiResult.confidence < 0.6) variantRisk = "HIGH";

        // Increment Quota
        //if (process.env.UPSTASH_REDIS_REST_URL && deviceId) {
        if (process.env.UPSTASH_REDIS_REST_URL && deviceId && !devBypass) {
            const d = new Date();
            const mk = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
            const rk = `scan:${deviceId}:${mk}`;
            await redis.incr(rk);
            await redis.expire(rk, 60 * 60 * 24 * 31);
        }

        // 4. Synthesize Candidates (NEVER EMPTY RULE)
        // If we have a title, we MUST return a candidate so the UI can verify/price it.
        const safeIssue = aiResult.issueNumber ? `#${aiResult.issueNumber}` : '';
        const syntheticCandidate = {
            editionId: `auto-${aiResult.seriesTitle}-${aiResult.issueNumber || '1'}`,
            seriesTitle: aiResult.seriesTitle,
            issueNumber: aiResult.issueNumber || null,
            displayName: `${aiResult.seriesTitle} ${safeIssue}`.trim(),
            year: aiResult.year || null,
            publisher: aiResult.publisher || "Unknown",
            coverUrl: body.thumbnailUrl || body.scanImageUrl || null,
            confidence: aiResult.confidence || 0.8
        };

        const candidates = [syntheticCandidate];

        // Debug info
        const isDebug = request.url.includes("debug=1");

        return Response.json({
            ok: true,
            provider: "openai",
            parse_method: parseMethod,
            best: {
                seriesTitle: aiResult.seriesTitle,
                issueNumber: aiResult.issueNumber,
                publisher: aiResult.publisher,
                year: aiResult.year,
                confidence: aiResult.confidence
            },
            candidates: candidates, // Explicitly populated now
            variantRisk: variantRisk,
            ...(isDebug ? { debug_raw: content, debug_len: base64Data.length } : {})
        });

    } catch (e) {
        console.error("Identify Error", e);
        return Response.json({ ok: false, error: e.message }, { status: 500 });
    }
}
