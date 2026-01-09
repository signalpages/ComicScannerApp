
import { redis } from '../_services/redis.js';

export const runtime = 'nodejs'; // Use nodejs for OpenAI client capabilities if needed

const extractBase64 = (input) => {
    if (typeof input === 'string') return input.replace(/^data:image\/\w+;base64,/, '').trim();
    if (input && typeof input === 'object') {
        if (typeof input.base64 === 'string') return input.base64.trim();
    }
    return null;
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
        if (process.env.UPSTASH_REDIS_REST_URL) {
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

                const used = await redis.get(redisKey);
                if ((parseInt(used) || 0) >= 5) {
                    return Response.json({
                        ok: false,
                        code: "SCAN_LIMIT_REACHED",
                        limit: 5,
                        reset: "monthly"
                    }, { status: 402 });
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
        let aiResult = {};
        try {
            aiResult = JSON.parse(content);
        } catch (e) {
            return Response.json({ ok: false, error: "Invalid JSON from AI" }, { status: 500 });
        }

        // Determine Variant Risk
        let variantRisk = "LOW";
        if (aiResult.variantHints && aiResult.variantHints.length > 0) variantRisk = "HIGH";
        if (aiResult.confidence < 0.6) variantRisk = "HIGH";

        // Increment Quota
        if (process.env.UPSTASH_REDIS_REST_URL && deviceId) {
            const d = new Date();
            const mk = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
            const rk = `scan:${deviceId}:${mk}`;
            await redis.incr(rk);
            await redis.expire(rk, 60 * 60 * 24 * 31);
        }

        return Response.json({
            ok: true,
            provider: "openai",
            best: {
                seriesTitle: aiResult.seriesTitle,
                issueNumber: aiResult.issueNumber,
                publisher: aiResult.publisher,
                year: aiResult.year,
                confidence: aiResult.confidence
            },
            candidates: [],
            variantRisk: variantRisk
        });

    } catch (e) {
        console.error("Identify Error", e);
        return Response.json({ ok: false, error: e.message }, { status: 500 });
    }
}
