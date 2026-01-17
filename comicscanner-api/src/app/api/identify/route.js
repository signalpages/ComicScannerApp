import { z } from "zod";
import OpenAI from "openai";
import { requireAnonId, enforceMonthlyQuota } from "@/lib/quota";

const openai = new OpenAI(); // Automatically uses OPENAI_API_KEY from env

const Body = z.object({
    image: z.string().min(10), // Base64 image
});

export async function POST(req) {
    // 1. Auth & Quota Guard
    const anonRes = await requireAnonId(req);
    if (!anonRes.ok) return Response.json(anonRes.body, { status: anonRes.status });

    const quota = await enforceMonthlyQuota(anonRes.anon);
    if (!quota.ok) return Response.json(quota.body, { status: quota.status });

    // 2. Parse Body
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

    // 3. Vision Identification
    try {
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

        // Normalize
        const candidate = {
            seriesTitle: result.seriesTitle || null,
            issueNumber: result.issueNumber ? String(result.issueNumber) : null,
            publisher: result.publisher || null,
            year: result.year || null,
            confidence: 1.0 // Placeholder for now, assumed high if identified
        };

        // Filter out complete garbage (no title)
        if (!candidate.seriesTitle) {
            return Response.json({ ok: true, code: "NO_MATCH", candidates: [] });
        }

        return Response.json({
            ok: true,
            candidates: [candidate]
        });

    } catch (error) {
        console.error("Vision Error:", error);
        // Soft failure - never 500
        return Response.json({
            ok: true,
            code: "VISION_ERROR", // informational
            candidates: []
        });
    }
}
