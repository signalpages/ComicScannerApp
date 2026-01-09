import { redis } from '../_services/redis.js';
import { getEbayMarketPrice } from '../_services/ebayService.js';

export const runtime = 'nodejs';

export async function POST(request) {
    try {
        const body = await request.json();
        let { seriesTitle, issueNumber, editionId } = body;

        // Validation
        if (!seriesTitle) {
            return Response.json({ ok: false, error: "Missing seriesTitle" }, { status: 400 });
        }

        // Clean Issue Number
        let issueClean = (issueNumber || '').toString().trim();
        if (issueClean.toUpperCase() === 'N/A' || issueClean.toUpperCase() === 'NULL') {
            issueClean = '';
        }
        const issueStr = issueClean;

        // Cache Key
        const normalizedQuery = `${seriesTitle} ${issueStr}`.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
        const cacheKey = `price:${normalizedQuery.replace(/\s+/g, '-')}`;

        // 1. Check Cache
        if (redis) {
            const cached = await redis.get(cacheKey);
            if (cached) {
                return Response.json({ ...cached, cached: true });
            }
        }

        // 2. Fetch Pricing
        const searchQ = `${seriesTitle} ${issueStr}`.trim();
        const result = await getEbayMarketPrice(searchQ);

        const responseData = {
            ok: true,
            pricing: result.value,
            ebay: {
                imageUrl: result.coverUrl,
                itemUrl: result.firstItemId ? `https://www.ebay.com/itm/${result.firstItemId.split('|')[1] || result.firstItemId}` : null
            },
            confidence: result.compsCount > 20 ? "HIGH" : (result.compsCount > 8 ? "MEDIUM" : "LOW"),
            // Keep legacy top-level for backward compat if needed, but 'ebay' is the new standard
            ...result
        };

        // 3. Cache
        if (redis && result.source !== 'error') {
            await redis.set(cacheKey, responseData, { ex: 43200 }); // 12h
        }

        return Response.json(responseData);

    } catch (e) {
        console.error("Price API Error", e);
        return Response.json({ ok: false, error: e.message }, { status: 500 });
    }
}
