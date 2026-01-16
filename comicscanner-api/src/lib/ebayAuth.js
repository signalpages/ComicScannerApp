import { redis } from "./redis";

const TOKEN_KEY = "ebay:oauth:token";

export async function getEbayAccessToken() {
    const cached = await redis.get(TOKEN_KEY);
    if (cached?.token) return cached.token;

    const clientId = process.env.EBAY_CLIENT_ID;
    const clientSecret = process.env.EBAY_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("Missing EBAY_CLIENT_ID/EBAY_CLIENT_SECRET");

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
        method: "POST",
        headers: {
            "Authorization": `Basic ${basic}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            grant_type: "client_credentials",
            scope: "https://api.ebay.com/oauth/api_scope",
        }),
    });

    if (!res.ok) {
        const t = await res.text();
        throw new Error(`eBay token fetch failed: ${res.status} ${t}`);
    }

    const json = await res.json();
    const token = json.access_token;
    const expiresIn = Number(json.expires_in || 7200);
    const cacheSeconds = Math.max(60, Math.min(expiresIn - 60, Number(process.env.EBAY_TOKEN_CACHE_SECONDS || 6900)));

    await redis.set(TOKEN_KEY, { token }, { ex: cacheSeconds });

    return token;
}
