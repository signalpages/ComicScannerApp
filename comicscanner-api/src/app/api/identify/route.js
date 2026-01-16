import { z } from "zod";
import { requireAnonId, enforceMonthlyQuota } from "@/lib/quota";

const Body = z.object({
    image: z.string().min(10),
});

export async function POST(req) {
    const anonRes = await requireAnonId(req);
    if (!anonRes.ok) return Response.json(anonRes.body, { status: anonRes.status });

    const quota = await enforceMonthlyQuota(anonRes.anon);
    if (!quota.ok) return Response.json(quota.body, { status: quota.status });

    let json;
    try { json = await req.json(); }
    catch { return Response.json({ ok: false, code: "BAD_JSON", error: "Invalid JSON body" }, { status: 400 }); }

    const parsed = Body.safeParse(json);
    if (!parsed.success) {
        return Response.json({ ok: false, code: "BAD_REQUEST", error: "Invalid request body" }, { status: 400 });
    }

    // TODO: Ximilar integration once paid tier is enabled.
    return Response.json({
        ok: false,
        code: "IDENTIFY_UNAVAILABLE",
        error: "Comic identification temporarily unavailable",
        candidates: []
    }, { status: 503 });
}
