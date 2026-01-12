
import { redis } from "./redis.js";

const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const CACHE_TTL = 60 * 60 * 24 * 7; // 7 days

function calculatePercentiles(prices) {
    if (!prices || prices.length === 0) return { poor: 0, typical: 0, nearMint: 0 };
    const sorted = [...prices].sort((a, b) => a - b);
    const n = sorted.length;
    const getP = (p) => sorted[Math.floor((n - 1) * p)];
    return {
        poor: getP(0.25),
        typical: getP(0.5),
        nearMint: getP(0.75),
    };
}

const norm = (s = "") => s.toLowerCase().trim();

export async function getEbaySoldPrice(query, options = {}) {
    const isStrict = options.strictMode || false;
    const cacheKey = `sold_comps_v2:${norm(query)}${isStrict ? "_strict" : ""}`;

    // 1. Check Cache
    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            // console.log(`[Pricing] Cache Hit for "${query}"`);
            return cached;
        }
    } catch (err) {
        console.error("Redis Cache Read Error:", err);
    }

    // 2. Perform Scrape
    try {
        let q = encodeURIComponent(`${query} -reprint -facsimile -poster -cp`);

        if (isStrict) {
            // Strict Comic Mode: Force "comic" + "issue" keywords and exclude junk
            const strictKeywords = `comic issue ${query}`;
            const exclusions =
                "-dvd -blu-ray -vhs -poster -print -tshirt -shirt -toy -figure " +
                "-plush -mug -lobby -photo -autograph -signed -pressbook " +
                "-lot -set -collection -reprint -facsimile -cp";
            q = encodeURIComponent(`${strictKeywords} ${exclusions}`);
        }

        const url = `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1&_ipg=60`;

        const resp = await fetch(url, {
            headers: {
                "User-Agent": USER_AGENT,
                "Accept-Language": "en-US,en;q=0.9",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache"
            },
        });

        if (!resp.ok) return null;
        const html = await resp.text();

        const rawItems = html.split('class="s-item__wrapper').slice(1);
        const slabKeywords = ["cgc", "cbcs", "pgx", "graded", "slabbed", "slab"];

        let rawPrices = [];
        let slabPrices = [];

        rawItems.forEach((block) => {
            // Extract Title
            const titleMatch = block.match(/<h3[^>]*class="s-item__title"[^>]*>([^<]+)<\/h3>/i) ||
                block.match(/<div[^>]*class="s-item__title"[^>]*><span[^>]*>([^<]+)<\/span><\/div>/i);
            if (!titleMatch) return;

            const rawTitle = titleMatch[1].replace(/<[^>]+>/g, "").replace(/^New Listing/i, "").trim();
            const title = norm(rawTitle);

            if (title.includes("facsimile") || title.includes("reprint") || title.includes("poster")) return;

            // Extract Price
            const priceMatch = block.match(/class="s-item__price"[^>]*>([^<]+)<\/span>/i);
            if (!priceMatch) return;

            const priceStr = priceMatch[1].replace(/[^0-9.]/g, "");
            const price = parseFloat(priceStr);

            if (isNaN(price) || price < 1) return;

            // Classify
            const isSlab = slabKeywords.some(w => title.includes(w));

            if (isSlab) {
                slabPrices.push(price);
            } else {
                rawPrices.push(price);
            }
        });

        // Compute stats
        const rawStats = calculatePercentiles(rawPrices);
        const slabStats = calculatePercentiles(slabPrices);
        const totalCount = rawPrices.length + slabPrices.length;

        if (totalCount === 0) return null;

        // Pricing Model:
        // Raw Median = Typical
        // Slab NearMint = NearMint (Premium)

        // Fallback logic if data is thin
        const rawMedian = rawStats.typical;
        // If we have slab NM price, use it. Else use slab typical. Else raw NM * 1.5? (Conservative)
        const slabHigh = slabStats.nearMint || slabStats.typical || (rawStats.nearMint * 1.5);

        // If no raw data but slabs exist (rare), infer down
        const finalTypical = rawPrices.length > 0 ? rawStats.typical : (slabHigh / 3);
        const finalPoor = rawPrices.length > 0 ? rawStats.poor : (finalTypical / 2);

        // Final check logic
        let finalValues = {
            poor: finalPoor,
            typical: finalTypical,
            nearMint: slabHigh // The key change: High end is defined by slabs
        };

        // Use slab prices to override "Near Mint" if available, effectively showing the "Slab Potential"
        if (slabPrices.length === 0) {
            // If no slabs, just return standard raw stats
            finalValues.nearMint = rawStats.nearMint;
        }

        // Sanity
        if (finalValues.typical < finalValues.poor) finalValues.typical = finalValues.poor;
        if (finalValues.nearMint < finalValues.typical) finalValues.nearMint = finalValues.typical;

        const result = {
            source: "ebay_sold_listings",
            value: {
                poor: Math.round(finalValues.poor),
                typical: Math.round(finalValues.typical),
                nearMint: Math.round(finalValues.nearMint),
                typical: Math.round(finalValues.typical),
                nearMint: Math.round(finalValues.nearMint),
                currency: "USD",
                confidence: totalCount < 5 ? 0.4 : 0.9 // Low confidence if data is thin
            },
            compsCount: totalCount,
            rawCount: rawPrices.length,
            slabCount: slabPrices.length
        };

        // 3. Save to Cache
        try {
            await redis.set(cacheKey, result, { ex: CACHE_TTL });
        } catch (err) {
            console.error("Redis Cache Write Error:", err);
        }

        return result;

    } catch (err) {
        console.error("eBay Sold Scrape Error:", err);
        return null;
    }
}
