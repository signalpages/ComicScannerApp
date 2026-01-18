import { redis } from "./redis";

const DEFAULT_LIMIT = 5;

function monthKey() {
    const d = new Date();
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${yyyy}${mm}`;
}

function parseUnlimitedList() {
    const raw = process.env.UNLIMITED_DEVICE_IDS || "";
    return new Set(
        raw.split(",").map(s => s.trim()).filter(Boolean)
    );
}

const unlimitedSet = parseUnlimitedList();

// SS-006: Prioritize x-install-id, fallback to x-anon-id
export async function requireAnonId(req) {
    // CS-202 Rule 1: Input normalization
    const url = new URL(req.url);
    const installId =
        url.searchParams.get("installId") ||
        req.headers.get("x-install-id")?.trim();

    if (installId) return { ok: true, anon: installId, type: 'install' };

    const anon = req.headers.get("x-anon-id")?.trim();
    if (anon) return { ok: true, anon, type: 'legacy' };

    // CS-604: Backend Contract - Do not block verify/price if ID missing
    // We return a "Zero UUID" which effectively bypasses strict quota (fails open on DB FK)
    // allowing the scan to proceed.
    return { ok: true, anon: "00000000-0000-0000-0000-000000000000", type: 'fallback' };
}

// SS-006: Key Migration - Now using Supabase 'usage_monthly'
export async function enforceMonthlyQuota(id, isPaid = false) {
    // 1. Unlimited / Paid bypass
    if (unlimitedSet.has(id)) return { ok: true, remaining: Number.MAX_SAFE_INTEGER, unlimited: true };
    // We don't check 'isPaid' here because we expect the caller to pass 'true' if the entitlement check passed.
    // However, for safety, if isPaid is true, just return ok.
    if (isPaid) return { ok: true, remaining: Number.MAX_SAFE_INTEGER, unlimited: true };

    const limit = Number(process.env.MONTHLY_SCAN_LIMIT || DEFAULT_LIMIT);
    const yyyymm = monthKey();

    // 2. Import Supabase (Dynamic import to avoid circular dep if any, though likely fine)
    const { supabaseAdmin } = await import("@/lib/supabaseAdmin");

    // 3. Increment Usage in DB
    // We use a stored procedure or just read-then-update transaction?
    // Supabase JS doesn't do transactions easily without RPC.
    // Simple approach: UPSERT with atomic increment approach if possible, or optimistic.
    // Given low concurrency per user, Read -> Check -> Update is probably fine.

    // Better: RPC 'increment_usage(install_id, yyyymm)' if we had it.
    // For now: Fetch current, check limit, update.

    // A. Fetch
    let { data: usage, error } = await supabaseAdmin
        .from('usage_monthly')
        .select('*')
        .eq('install_id', id)
        .eq('yyyymm', yyyymm)
        .single();

    if (error && error.code !== 'PGRST116') {
        // Real DB error
        console.error("Quota Fetch Error", error);
        return { ok: true, remaining: limit }; // Fail open
    }

    const currentUsed = usage ? usage.scans_used : 0;

    if (currentUsed >= limit) {
        return {
            ok: false,
            status: 429, // Too Many Requests
            body: {
                ok: false,
                code: "SCAN_LIMIT_REACHED",
                error: "Monthly scan limit reached",
                scansUsed: currentUsed,
                scansFree: limit,
                remaining: 0
            },
            used: currentUsed,
            limit,
            remaining: 0
        };
    }

    // B. Increment
    // If row didn't exist, we create it with 1.
    // If it did, we invalidly overwrite if race condition?
    // Given it's per-user, race is unlikely unless double-tapping scan.
    const newUsed = currentUsed + 1;

    const { error: upsertError } = await supabaseAdmin
        .from('usage_monthly')
        .upsert({
            install_id: id,
            yyyymm: yyyymm,
            scans_used: newUsed
        });

    if (upsertError) {
        console.error("Quota Increment Error", upsertError);
        // If update fails, we allowed the scan but didn't count it. Acceptable for now.
    }

    return { ok: true, used: newUsed, limit, remaining: limit - newUsed };
}
