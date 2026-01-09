
import { redis } from './redis.js';

const CLIENT_ID = process.env.EBAY_CLIENT_ID;
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
const ENV = process.env.EBAY_ENV || 'PRODUCTION'; // SANDBOX or PRODUCTION
const URL = ENV === 'SANDBOX'
    ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
    : 'https://api.ebay.com/identity/v1/oauth2/token';

export const getEbayToken = async () => {
    // 1. Check Cache
    if (!redis) throw new Error("Redis not configured");

    const token = await redis.get('ebay:token');
    if (token) return token;

    // 2. Fetch New Token
    if (!CLIENT_ID || !CLIENT_SECRET) {
        throw new Error("Missing eBay Credentials");
    }

    const credentials = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);

    const resp = await fetch(URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`
        },
        body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
    });

    if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`eBay Token Error: ${txt}`);
    }

    const data = await resp.json();
    const newToken = data.access_token;
    const ttl = data.expires_in - 120; // Buffer

    // 3. Cache it
    await redis.set('ebay:token', newToken, { ex: ttl });

    return newToken;
};
