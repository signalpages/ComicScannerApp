import { supabaseAdmin, checkSupabaseConfig } from "@/lib/supabaseAdmin";

export const dynamic = 'force-dynamic';

export async function GET(req) {
    if (!checkSupabaseConfig()) {
        return Response.json({ ok: false, code: "SUPABASE_MISCONFIGURED" }, { status: 500 });
    }

    // Normalization rule: Query > Header
    const url = new URL(req.url);
    const installId = url.searchParams.get("installId") || req.headers.get("x-install-id");

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!installId || !uuidRegex.test(installId)) {
        return Response.json({ ok: false, error: "Invalid installId" }, { status: 400 });
    }

    const currentMonth = new Date().toISOString().slice(0, 7).replace('-', ''); // "202601"

    // Fetch Entitlement & Usage parallel
    const [entitlementRes, usageRes] = await Promise.all([
        supabaseAdmin.from('entitlements').select('*').eq('install_id', installId).single(),
        supabaseAdmin.from('usage_monthly').select('*').eq('install_id', installId).eq('yyyymm', currentMonth).single()
    ]);

    const isPro = entitlementRes.data?.is_pro || false;
    const scansUsed = usageRes.data?.scans_used || 0;
    const SCANS_FREE_LIMIT = 5;

    const remainingFree = Math.max(0, SCANS_FREE_LIMIT - scansUsed);

    // GATING LOGIC
    // If Pro -> OK
    // If Free & remaining > 0 -> OK
    // Else -> LIMIT_REACHED

    let shouldGate = false;
    if (!isPro && remainingFree <= 0) {
        shouldGate = true;
    }

    if (shouldGate) {
        // CS-202 Rule: Return 200 OK with code=LIMIT_REACHED
        return Response.json({
            ok: false,
            code: "LIMIT_REACHED",
            scansUsed,
            scansFree: SCANS_FREE_LIMIT,
            resetAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(), // Start of next month
            isPro,
            shouldPaywall: true,
            backendVersion: process.env.VERCEL_GIT_COMMIT_SHA || "dev"
        });
    }

    return Response.json({
        ok: true,
        yyyymm: currentMonth,
        scansUsed,
        scansFree: SCANS_FREE_LIMIT,
        remainingFree,
        isPro,
        shouldPaywall: false,
        backendVersion: process.env.VERCEL_GIT_COMMIT_SHA || "dev"
    });
}
