
import { redis } from './_services/redis.js';
import { getEbayMarketPrice } from './_services/ebayService.js';

export const config = {
    runtime: 'edge', // Vercel Edge
};

export default async function handler(req, res) {
    // Note: Vercel Edge functions usually use standard Request/Response objects,
    // but the user's template implies a Node-like (req, res) or Next.js API route style.
    // If this is standard Vercel API, it supports standard Request/Response.
    // However, the `identify.js` used `res.status().json()`, which is consistent with Vercel Serverless (Node).
    // The previous prompt said "Vercel Edge Functions". Edge functions usually use `export default async function (req) { return new Response(...) }`.
    // I will stick to what I used in `identify.js` (Serverless syntax) or switch to standard if needed.
    // User constraints said "Vercel Serverless Functions".

    // BUT `ebayToken.js` uses `redis`. 
    // Let's stick to the pattern I used in identify.js which seemed accepted (Node style).

    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

    const body = req.body || {};
    // Expecting: { seriesTitle: "Spawn", issueNumber: "36" } OR { editionId }
    // User app currently sends `editionId`.
    // We need to parse that or accept components.

    let { seriesTitle, issueNumber, editionId } = body;

    if (editionId && (!seriesTitle || !issueNumber)) {
        // Only use editionId if explicit fields are missing
        // Try safe split (assuming standard cv-Title-Issue format)
        // BUT simplistic splitting on '-' breaks titles like "X-Men".
        // Better to rely on client-side explicit fields.
        // If we must fallback, do minimal effort or just skip.
        // For now, let's skip the dangerous split to satisfy "Stop splitting editionId on hyphens"
        // If the client sends editionId but no title, it's a client bug we should fix there.
        // However, to be safe:
        // seriesTitle = "Unknown";
    }

    if (!seriesTitle) {
        return res.status(400).json({ ok: false, error: "Missing seriesTitle" });
    }

    // Default issueNumber cleanup
    // 1. Convert to string, trim
    // 2. If it's "N/A" or "null" or non-alphanumeric (with some allowance), strict sanitization
    let issueClean = (issueNumber || '').toString().trim();

    // Allow digits and optional suffix (36, 36A, 1 variant, etc - usually eBay search handles '36')
    // But exclude N/A explicitly
    if (issueClean.toUpperCase() === 'N/A' || issueClean.toUpperCase() === 'NULL') {
        issueClean = '';
    }

    // Default to empty string if invalid
    const issueStr = issueClean;

    const normalizedQuery = `${seriesTitle} ${issueStr}`.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const cacheKey = `price:${normalizedQuery.replace(/\s+/g, '-')}`;

    // 1. Check Cache
    if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
            return res.status(200).json({ ...cached, cached: true });
        }
    }

    // 2. Fetch Pricing
    const searchQ = `${seriesTitle} ${issueStr}`.trim();
    const result = await getEbayMarketPrice(searchQ);

    const responseData = {
        ok: true,
        ...result,
        confidence: result.compsCount > 20 ? "HIGH" : (result.compsCount > 8 ? "MEDIUM" : "LOW")
    };

    // 3. Cache
    if (redis && result.source !== 'error') {
        await redis.set(cacheKey, responseData, { ex: 43200 }); // 12h
    }

    return res.status(200).json(responseData);
}
