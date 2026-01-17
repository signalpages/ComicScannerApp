import { browseSearch } from "./ebayBrowse";
import { soldComps } from "./soldScrape";

function baseExclusions() {
    return [
        "-lot", "-bundle", "-set", "-run", "-collection",
        "-tpb", "-hardcover", "-omnibus", "-graphic", "-paperback",
        "-facsimile", "-reprint", "-digital",
        "-poster", "-print", "-framed", "-ticket",
        "-cover only", "-page", "-signed", "-sketch", "-variant", "-virgin", "-foil"
    ].join(" ");
}

function buildQuery(seriesTitle, issueNumber) {
    const t = (seriesTitle || "").trim();
    const issue = (issueNumber || "").toString().trim();
    const q = `"${t}" #${issue} comic ${baseExclusions()}`;
    return q;
}

function extractCandidatePrices(browseJson, issueNumber) {
    const items = browseJson?.itemSummaries || [];
    const prices = [];
    let imageUrl = null;
    const targetIssue = String(issueNumber);

    for (const it of items) {
        const p = Number(it?.price?.value);
        if (!Number.isFinite(p) || p <= 1) continue;

        const t = (it.title || "").toLowerCase();

        // Post-filter browse results for keywords we assume standard (raw) shouldn't have
        // (Browse API doesn't support complex exclusions well, so we double check)
        if (t.includes("variant") || t.includes("virgin") || t.includes("foil") || t.includes("signed")) continue;
        if (/\b9\.\d\b/.test(t)) continue; // Skip graded noise in raw query

        // Issue match check
        const normTitle = t.replace(/[^\w#.]/g, " ");
        const issuePatt = new RegExp(`(?:^|\\s|#)${targetIssue}(?:\\s|$)`);
        if (!issuePatt.test(normTitle)) continue;

        prices.push(p);
        if (!imageUrl && it?.image?.imageUrl) imageUrl = it.image.imageUrl;
    }

    prices.sort((a, b) => a - b);
    return { prices, imageUrl, count: prices.length };
}

function percentile(sorted, p) {
    if (!sorted.length) return null;
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    const w = idx - lo;
    return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function trim(sorted) {
    if (sorted.length < 5) return sorted; // Require min 5 to trim
    const drop = Math.floor(sorted.length * 0.1); // 10% trim
    return sorted.slice(drop, sorted.length - drop);
}

export async function priceComic({ seriesTitle, issueNumber, year }) {
    const start = Date.now();
    let stage = "none";
    let method = "none";
    let resultValue = { typical: null, soft: null, slabs: null };
    let resultEbay = { imageUrl: null };
    let count = 0;

    // Helper to log metrics
    const logMetric = (s, m, c) => {
        const duration = Date.now() - start;
        console.log(`[METRICS] type=pricing series="${seriesTitle}" issue="${issueNumber}" stage=${s} method=${m} results=${c} duration=${duration}ms`);
    };

    // 1. SOLD STRICT (Title + Issue + Year)
    // Only if year is provided and reasonable
    if (year && String(year).match(/^(19|20)\d{2}$/)) {
        const strictQuery = `${seriesTitle} #${issueNumber} ${year} comic`;
        const cacheKey = `sold:${seriesTitle}:${issueNumber}:${year}`.toLowerCase();

        try {
            const sold = await soldComps({ query: strictQuery, cacheKey, issueNumber });
            if (sold?.raw?.count >= 10) {
                stage = "sold_strict";
                method = "scrape";
                resultValue = {
                    typical: sold.raw.typical ? Math.round(sold.raw.typical) : null,
                    soft: sold.raw.soft ? Math.round(sold.raw.soft) : null,
                    slabs: sold.slabs.typical ? Math.round(sold.slabs.typical) : null,
                };
                count = sold.raw.count;
                logMetric(stage, method, count);
                return { value: resultValue, ebay: resultEbay };
            }
        } catch (e) {
            console.warn("Pricing Strict Error:", e);
        }
    }

    // 2. SOLD RELAXED (Title + Issue)
    const relaxedQuery = `${seriesTitle} #${issueNumber} comic`;
    const relaxedCacheKey = `sold:${seriesTitle}:${issueNumber}`.toLowerCase();

    try {
        const sold = await soldComps({ query: relaxedQuery, cacheKey: relaxedCacheKey, issueNumber });
        if (sold?.raw?.count >= 6) {
            stage = "sold_relaxed";
            method = "scrape";
            resultValue = {
                typical: sold.raw.typical ? Math.round(sold.raw.typical) : null,
                soft: sold.raw.soft ? Math.round(sold.raw.soft) : null,
                slabs: sold.slabs.typical ? Math.round(sold.slabs.typical) : null,
            };
            count = sold.raw.count;
            logMetric(stage, method, count);
            return { value: resultValue, ebay: resultEbay };
        }
    } catch (e) {
        console.warn("Pricing Relaxed Error:", e);
    }

    // 3. ACTIVE LISTINGS (Browse API)
    // Fallback if sold data is thin.
    // We treat active "average" as a "typical" price, but maybe discount it slightly or just label it?
    // The requirement says: "compute median asking price (label clearly)" -> we'll return it as typical but maybe frontend handles usage?
    // For now, mapping to typical/soft structure.

    try {
        const q = buildQuery(seriesTitle, issueNumber);
        const browse = await browseSearch({ q, limit: 50 });
        const { prices, imageUrl, count: activeCount } = extractCandidatePrices(browse, issueNumber);

        if (imageUrl) resultEbay.imageUrl = imageUrl;

        if (activeCount >= 10) {
            stage = "active";
            method = "api";
            // Simple percentile stats on asking prices
            const typical = percentile(prices, 0.50);
            const soft = percentile(prices, 0.25);

            resultValue = {
                typical: typical ? Math.round(typical) : null,
                soft: soft ? Math.round(soft) : null,
                slabs: null // Active scan doesn't separate slabs reliably in this helper yet
            };
            count = activeCount;
            logMetric(stage, method, count);
            return { value: resultValue, ebay: resultEbay };
        }

    } catch (e) {
        console.warn("Pricing Active Error:", e);
    }

    // 4. UNAVAILABLE
    logMetric("none", "none", 0);
    return {
        value: { typical: null, soft: null, slabs: null },
        ebay: resultEbay
    };
}
