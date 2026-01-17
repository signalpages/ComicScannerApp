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

    const quota = await enforceMonthlyQuota(anonRes.anon);
    if (!quota.ok) return Response.json(quota.body, { status: quota.status });

    let json;
    try {
        json = await req.json();
    } catch {
        return Response.json({ ok: false, code: "BAD_JSON", error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = Body.safeParse(json);
    if (!parsed.success) {
        return Response.json({ ok: false, code: "BAD_REQUEST", error: "Invalid request body" }, { status: 400 });
    }

    try {
        const out = await priceComic({
            seriesTitle: parsed.data.seriesTitle,
            issueNumber: parsed.data.issueNumber,
            year: parsed.data.year, // CS-027: Pass year
        });

        return Response.json({ ok: true, ...out });
    } catch (e) {
        return Response.json({ ok: false, code: "PRICE_FAILED", error: String(e?.message || e) }, { status: 500 });
    }
}
