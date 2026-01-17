import { supabaseAdmin, checkSupabaseConfig } from "@/lib/supabaseAdmin";
import { redis } from "@/lib/redis";
import { Ratelimit } from "@upstash/ratelimit";

// SS-005: Rate Limit Install Registration
// 10 registrations per day per IP
const ratelimit = new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(10, "24h"),
    prefix: "install_reg",
    analytics: true,
});

export async function POST(req) {
    if (!checkSupabaseConfig()) {
        return Response.json({ ok: false, code: "SUPABASE_MISCONFIGURED", error: "Back-end misconfigured (Invalid DB Key)" }, { status: 500 });
    }

    // 1. Rate Limit Check
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const { success } = await ratelimit.limit(ip);

    if (!success) {
        return Response.json({
            ok: false,
            code: "INSTALL_RATE_LIMITED",
            error: "Too many install attempts. Please try again later."
        }, { status: 429 });
    }

    // 2. Parse Input (Strict Normalization)
    let body = {};
    try { body = await req.json(); } catch { }

    const url = new URL(req.url);
    const clientInstallId =
        url.searchParams.get("installId") ||
        req.headers.get("x-install-id") ||
        body.clientInstallId ||
        body.deviceId; // Supporting legacy payload

    const deviceId = body.deviceId || null;
    const platform = body.platform || "unknown";
    const appVersion = body.appVersion || "unknown";

    // CS-201: Store debug headers
    const debugHeaders = {};
    req.headers.forEach((v, k) => {
        if (k.startsWith('x-') || k === 'user-agent') debugHeaders[k] = v;
    });

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let installId = null;

    // 3. Upsert / Resolve Identity
    if (clientInstallId && uuidRegex.test(clientInstallId)) {
        // A. Valid UUID provided -> Upsert Last Seen
        const { data, error } = await supabaseAdmin
            .from('installs')
            .update({
                last_seen_at: new Date().toISOString(),
                last_headers: debugHeaders,
                app_version: appVersion,
                platform: platform
            })
            .eq('install_id', clientInstallId) // Supabase DB uses snake_case 'install_id'
            .select('install_id') // Select install_id (DB column)
            .single();

        if (data && !error) {
            installId = data.install_id;
        } else {
            // If update failed (ID didn't exist?), fall through to create
            console.warn(`[Install] Client claimed ID ${clientInstallId} but not found in DB.`);
        }
    }

    if (!installId) {
        // B. Create New Install (or recover by Device ID if implemented later)
        // For now, simple insert
        const { data: newInstall, error: insertError } = await supabaseAdmin
            .from('installs')
            .insert({
                device_id: deviceId, // If provided
                platform: platform,
                app_version: appVersion,
                last_headers: debugHeaders
            })
            .select('install_id')
            .single();

        if (insertError || !newInstall) {
            console.error("Install creation failed", insertError);
            return Response.json({ ok: false, error: "Failed to generate ID" }, { status: 500 });
        }
        installId = newInstall.install_id;
    }

    // 4. Ensure Dependencies (Entitlements + Usage)
    const currentMonth = new Date().toISOString().slice(0, 7).replace('-', ''); // "202601"

    // Ensure Entitlement Row
    // We use ON CONFLICT DO NOTHING (or just ignore error)
    await supabaseAdmin
        .from('entitlements')
        .insert({ install_id: installId })
        .select() // fake select to execute
        .maybeSingle() // Ignore conflict error implicitly or we can be explicit if we use upsert
        .catch(() => { });

    // Ensure Usage Row
    await supabaseAdmin
        .from('usage_monthly')
        .insert({ install_id: installId, yyyymm: currentMonth })
        .select()
        .maybeSingle()
        .catch(() => { });

    // 5. Fetch State
    const [entitlementRes, usageRes] = await Promise.all([
        supabaseAdmin.from('entitlements').select('*').eq('install_id', installId).single(),
        supabaseAdmin.from('usage_monthly').select('*').eq('install_id', installId).eq('yyyymm', currentMonth).single()
    ]);

    const entitlement = entitlementRes.data || { is_pro: false, status: 'inactive' };
    const usage = usageRes.data || { scans_used: 0 };
    const SCANS_FREE_LIMIT = 5;

    return Response.json({
        ok: true,
        installId: installId,
        backendVersion: process.env.VERCEL_GIT_COMMIT_SHA || "dev", // CS-205
        entitlement: {
            isPro: entitlement.is_pro,
            planId: entitlement.plan_id,
            status: entitlement.status,
            expiresAt: entitlement.expires_at
        },
        usage: {
            yyyymm: currentMonth,
            scansUsed: usage.scans_used,
            scansFree: SCANS_FREE_LIMIT,
            remainingFree: Math.max(0, SCANS_FREE_LIMIT - usage.scans_used)
        }
    });
}
