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

export async function requireAnonId(req) {
    const anon = req.headers.get("x-anon-id")?.trim();
    if (!anon) {
        return { ok: false, status: 400, body: { ok: false, code: "MISSING_ANON_ID", error: "Missing x-anon-id" } };
    }
    return { ok: true, anon };
}

export async function enforceMonthlyQuota(anon) {
    if (unlimitedSet.has(anon)) return { ok: true, remaining: Number.MAX_SAFE_INTEGER, unlimited: true };

    const limit = Number(process.env.MONTHLY_SCAN_LIMIT || DEFAULT_LIMIT);
    const key = `quota:${anon}:${monthKey()}`;

    // Increment usage
    const used = await redis.incr(key);

    // Ensure key expires ~40 days so month rolls naturally even if inactive
    if (used === 1) {
        await redis.expire(key, 60 * 60 * 24 * 40);
    }

    const remaining = Math.max(0, limit - used);

    if (used > limit) {
        return {
            ok: false,
            status: 429,
            body: { ok: false, code: "MONTHLY_LIMIT", error: "Monthly limit reached" },
            used,
            limit,
            remaining
        };
    }

    return { ok: true, used, limit, remaining };
}
