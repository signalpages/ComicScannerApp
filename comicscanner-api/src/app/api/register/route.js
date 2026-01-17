import { z } from "zod";
import crypto from "crypto";
import { redis } from "@/lib/redis"; // Assumes we have a redis lib, usually upstash
import { Ratelimit } from "@upstash/ratelimit";

// Rate Limit: 5 registrations per 24h per IP
const ratelimit = new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(5, "24h"),
    prefix: "ratelimit:register",
});

export async function POST(req) {
    // Basic IP detection (Vercel/Next headers)
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";

    // 1. Check Rate Limit
    const { success, limit, remaining, reset } = await ratelimit.limit(ip);
    if (!success) {
        return Response.json({
            ok: false,
            code: "RATE_LIMIT_EXCEEDED",
            error: "Too many new device registrations. Try again later."
        }, { status: 429 });
    }

    // 2. Generate Token
    const installToken = crypto.randomUUID();
    const installId = `usr_${installToken}`; // Prefix for clarity

    // 3. Store ID (Optional - for future tracking/banning)
    // For now we just return it. The quota system tracks it as it appears.

    // Log for accountability
    console.log(`[REGISTER] New Install: ${installId} (IP: ${ip})`);

    return Response.json({
        ok: true,
        installToken: installId
    });
}
