import { supabaseAdmin, checkSupabaseConfig } from "@/lib/supabaseAdmin";
import { redis } from "@/lib/redis";
import { Ratelimit } from "@upstash/ratelimit";

// SS-005: Rate Limit Install Registration
// 10 registrations per day per IP
// CS-302: Relaxed Rate Limit - 100 per minute per IP (effectively unlimited for normal use)
const ratelimit = new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(100, "1m"),
    prefix: "install_reg",
    analytics: true,
});

export async function POST(req) {
    // 1. Check Config (Soft fail if possible, but misconfigured DB key is fatal for logic usually. 
    // However, user wants "degraded" mode. If config is bad, we can't do DB. 
    // We return degraded response.)
    if (!checkSupabaseConfig()) {
        console.error("Supabase config missing");
        return Response.json({ ok: true, degraded: true, error: "Backend config missing" });
    }

    try {
        // 2. Rate Limit (Relaxed)
        const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
        const { success } = await ratelimit.limit(ip);
        if (!success) {
            console.warn("Rate limit hit for IP:", ip);
            // Even if rate limited, return degraded to keep app working?
            // "Install endpoint remains stable"
            // If we rate limit, we block. But at 100/min, real users won't hit it.
            // If we assume a DDOS, we SHOULD block.
            return Response.json({ ok: false, error: "Too many requests" }, { status: 429 });
        }

        // 3. Parse Input
        let body = {};
        try { body = await req.json(); } catch { }

        // CS-302: Accept deviceId from Header OR Body
        const deviceId =
            req.headers.get("x-device-id") ||
            body.deviceId ||
            null;

        const url = new URL(req.url);
        // CS-302: Priority order for clientInstallId (legacy name in code, but fits pattern)
        const clientInstallId =
            url.searchParams.get("installId") ||
            req.headers.get("x-install-id") ||
            body.installId || // Spec says body { installId } might be sent
            body.clientInstallId;

        const platform = body.platform || req.headers.get("x-platform") || "unknown";
        const appVersion = body.appVersion || req.headers.get("x-app-version") || "unknown";

        // CS-201: Store debug headers
        const debugHeaders = {};
        req.headers.forEach((v, k) => {
            if (k.startsWith('x-') || k === 'user-agent') debugHeaders[k] = v;
        });

        // 4. DB Operations (Wrapped in Try/Catch for Degraded Mode)
        let installId = null;
        let finalEntitlements = { isPro: false, status: 'inactive' };
        let finalUsage = { scansUsed: 0 };
        const SCANS_FREE_LIMIT = 5;

        // ... Existing DB Logic ...
        // We need to resolve ID.
        // If client provided an ID, trust/upsert it.
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (clientInstallId && uuidRegex.test(clientInstallId)) {
            const { data, error } = await supabaseAdmin
                .from('installs')
                .upsert({
                    install_id: clientInstallId,
                    device_id: deviceId, // Link stable device ID
                    last_seen_at: new Date().toISOString(),
                    last_headers: debugHeaders,
                    app_version: appVersion,
                    platform: platform
                }, { onConflict: 'install_id' })
                .select('install_id')
                .single();

            if (data && !error) installId = data.install_id;
            else console.error("Upsert error", error);
        }

        // If no ID (or upsert failed/not found?), try explicit create
        if (!installId) {
            const { data: newInstall, error: insertError } = await supabaseAdmin
                .from('installs')
                .insert({
                    device_id: deviceId,
                    platform: platform,
                    app_version: appVersion,
                    last_headers: debugHeaders
                })
                .select('install_id')
                .single();

            if (newInstall && !insertError) installId = newInstall.install_id;
            else throw new Error("Creation failed: " + (insertError?.message || "Unknown"));
        }

        // Dependencies
        const currentMonth = new Date().toISOString().slice(0, 7).replace('-', '');

        // Parallel ensure
        await Promise.allSettled([
            supabaseAdmin.from('entitlements').insert({ install_id: installId }).select().maybeSingle(),
            supabaseAdmin.from('usage_monthly').insert({ install_id: installId, yyyymm: currentMonth }).select().maybeSingle()
        ]);

        // Fetch State
        const [entitlementRes, usageRes] = await Promise.all([
            supabaseAdmin.from('entitlements').select('*').eq('install_id', installId).single(),
            supabaseAdmin.from('usage_monthly').select('*').eq('install_id', installId).eq('yyyymm', currentMonth).single()
        ]);

        if (entitlementRes.data) finalEntitlements = entitlementRes.data;
        if (usageRes.data) finalUsage = { scansUsed: usageRes.data.scans_used };

        return Response.json({
            ok: true,
            installId: installId,
            deviceId: deviceId, // Echo back
            backendVersion: process.env.VERCEL_GIT_COMMIT_SHA || "dev",
            entitlement: {
                isPro: finalEntitlements.is_pro,
                planId: finalEntitlements.plan_id,
                status: finalEntitlements.status,
                expiresAt: finalEntitlements.expires_at
            },
            usage: {
                yyyymm: currentMonth,
                scansUsed: finalUsage.scansUsed,
                scansFree: SCANS_FREE_LIMIT,
                remainingFree: Math.max(0, SCANS_FREE_LIMIT - finalUsage.scansUsed)
            }
        });

    } catch (e) {
        console.error("[Install] Fatal Error (Degraded Mode)", e);
        // CS-302: Degraded Mode
        return Response.json({
            ok: true,
            degraded: true,
            installId: null,
            usage: null,
            error: "Backend unavailable"
        });
    }
}
