
import { redis } from './_services/redis.js';
import { getEbayMarketPrice } from './_services/ebayService.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

    const { editionId } = req.body;
    // editionId format assumption: "source-title-issue-variant"
    // e.g. "manual-Spawn-1-A"

    // Parse ID or just use it as string

    // --- QUOTA GATING START ---
    // User ID (anon) usually from header or body. Let's assume passed in body for simplicity or header 'x-anon-id'
    const anonId = req.headers['x-anon-id'] || 'unknown_user';
    const date = new Date();
    const quotaKey = `quota:${date.getFullYear()}-${date.getMonth() + 1}:${anonId}`;

    // Check limit
    let limitReached = false;
    let currentUsage = 0;

    if (redis) {
        currentUsage = await redis.incr(quotaKey);
        if (currentUsage > 5) {
            limitReached = true;
        }
    }
    // --- QUOTA GATING END ---

    // Cache Check
    const cacheKey = `price:${editionId}`;
    let priceData = null;

    if (redis) {
        priceData = await redis.get(cacheKey);
    }

    if (!priceData) {
        // Fetch specific price
        // Extract basic info from ID if possible, or pass ID to service
        // Hacky extraction for demo V1
        const parts = editionId.split('-'); // simple split
        const title = parts[1] || 'Unknown';
        const issue = parts[2] || '1';

        const ebayResult = await getEbayMarketPrice(title, issue);

        priceData = {
            value: {
                poor: Math.round(ebayResult.raw * 0.4),
                typical: ebayResult.raw,
                nearMint: Math.round(ebayResult.raw * 1.8),
                currency: 'USD',
                confidence: ebayResult.sampleSize > 20 ? 'HIGH' : (ebayResult.sampleSize > 8 ? 'MEDIUM' : 'LOW'),
                compsCount: ebayResult.sampleSize
            },
            comps: [] // Populate if available from service
        };

        // Cache it
        if (redis) await redis.set(cacheKey, priceData, { ex: 21600 }); // 6h
    }

    if (limitReached) {
        return res.status(200).json({
            ok: true,
            editionId,
            limitReached: true,
            value: {
                poor: '??',
                typical: '??',
                nearMint: '??', // Masked
                currency: 'USD',
                confidence: 'BLURRED',
                compsCount: 0
            },
            comps: []
        });
    }

    return res.status(200).json({
        ok: true,
        editionId,
        ...priceData
    });
}
