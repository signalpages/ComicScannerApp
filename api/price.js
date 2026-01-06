
import { redis } from './_services/redis.js';
import { getEbayMarketPrice } from './_services/ebayService.js';

export const config = {
    runtime: 'edge',
};

export default async function handler(req) {
    const { searchParams } = new URL(req.url);
    const title = searchParams.get('title');
    const issue = searchParams.get('issue');
    const comicId = searchParams.get('id'); // Metron/CV ID if available

    if (!title || !issue) {
        return new Response(JSON.stringify({ error: 'Missing title or issue' }), { status: 400 });
    }

    const cacheKey = `price:${comicId || `${title}_${issue}`.replace(/\s+/g, '_').toLowerCase()}`;

    try {
        // 1. Check Cache
        const cached = await redis.get(cacheKey);
        if (cached) {
            return new Response(JSON.stringify({ ...cached, cached: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 2. Fetch Live Price
        const priceData = await getEbayMarketPrice(title, issue);

        // 3. Cache Result (12 hours = 43200 seconds)
        if (priceData.source !== 'error' && priceData.source !== 'exception') {
            await redis.set(cacheKey, priceData, { ex: 43200 });
        }

        return new Response(JSON.stringify({ ...priceData, cached: false }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    }
}
