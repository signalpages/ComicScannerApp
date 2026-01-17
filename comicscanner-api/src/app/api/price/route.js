import { z } from "zod";
import { requireAnonId, enforceMonthlyQuota } from "@/lib/quota";
import { priceComic } from "@/lib/pricing";

const Body = z.object({
    seriesTitle: z.string().min(1),
    issueNumber: z.union([z.string(), z.number()]).transform(String),
    editionId: z.string().optional().nullable(),
    year: z.union([z.number(), z.string(), z.null()]).optional(), // CS-027
});

export async function POST(req) {
    const anonRes = await requireAnonId(req);
    if (!anonRes.ok) return Response.json(anonRes.body, { status: anonRes.status });

    // CS-203: Manual lookup is free. Pricing endpoint is used for both Scan results and Manual.
    // Quota is enforced at /api/identify (Scanning) or client-side gating.
    // const quota = await enforceMonthlyQuota(anonRes.anon);
    // if (!quota.ok) return Response.json(quota.body, { status: quota.status });

    let json;
    try {
        json = await req.json();
    } catch {
        return Response.json({ ok: false, code: "BAD_JSON", error: "Invalid JSON body" }, { status: 400 });
    }

    // CS-056: Soft Fail for Pricing
    try {
        const parsed = Body.safeParse(json);
        if (!parsed.success) {
            // Invalid params? Just say price unavailable.
            console.warn("Pricing Bad Request", parsed.error);
            return Response.json({ ok: true, available: false, value: { typical: null } });
        }

        const out = await priceComic({
            seriesTitle: parsed.data.seriesTitle,
            issueNumber: parsed.data.issueNumber,
            year: parsed.data.year, // CS-027: Pass year
        });

        return Response.json({
            ok: true,
            available: true,
            ...out,
            backendVersion: process.env.VERCEL_GIT_COMMIT_SHA || "dev"
        });
    } catch (e) {
        console.warn("Pricing Failed (Soft)", e);
        return Response.json({
            ok: true,
            available: false,
            value: { typical: null },
            error: String(e.message),
            backendVersion: process.env.VERCEL_GIT_COMMIT_SHA || "dev"
        });
    }
}
