
import { getEbayToken } from './ebayToken.js';

const calculatePercentiles = (prices) => {
    if (!prices || prices.length === 0) return { poor: 0, typical: 0, nearMint: 0 };

    // Sort
    const sorted = [...prices].sort((a, b) => a - b);
    const n = sorted.length;

    // Helper to get value at percentile
    const getP = (p) => {
        const index = Math.floor((n - 1) * p);
        return sorted[index];
    };

    return {
        poor: getP(0.25),
        typical: getP(0.50),
        nearMint: getP(0.75)
    };
};

export const getEbayMarketPrice = async (query) => {
    try {
        const token = await getEbayToken();

        // Search Active Listings
        // exclude lots, tpb, etc.
        // "Active" listings on eBay Browse API usually implies no specific filter for "COMPLETED"
        // so standard search returns active.
        const q = `${query} -lot -set -tpb -hardcover -facsimile -reprint`;

        const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&limit=100&sort=price`;

        const resp = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
            }
        });

        if (!resp.ok) throw new Error("eBay Search Failed");

        const data = await resp.json();
        const items = data.itemSummaries || [];

        // Filter outliers (simple price sanity check, e.g. > $1)
        const validItems = items.filter(i => {
            const val = parseFloat(i.price.value);
            return val > 1 && i.buyingOptions.includes('FIXED_PRICE'); // Prefer BIN for "Active" market check? Or mixed?
            // "Active listings" implies current asking prices.
        });

        const prices = validItems.map(i => parseFloat(i.price.value));

        const values = calculatePercentiles(prices);

        return {
            source: "ebay_browse_active_listings",
            coverUrl: items[0]?.image?.imageUrl || null, // Fallback image
            firstItemId: items[0]?.itemId || null, // Useful for linking
            value: {
                ...values,
                currency: "USD"
            },
            compsCount: prices.length
        };

    } catch (e) {
        console.error("eBay Service Error", e);
        return { source: "error", value: { poor: 0, typical: 0, nearMint: 0, currency: "USD" }, compsCount: 0 };
    }
};
