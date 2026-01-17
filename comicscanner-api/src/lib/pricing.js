import { browseSearch } from "./ebayBrowse";
import { soldComps } from "./soldScrape";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// SS-008: Pricing Cache TTL (7 days)
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function normalizeKey(series, issue) {
    const s = (series || "").toLowerCase().replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "");
    const i = (issue || "").toString().toLowerCase().replace(/[^\w.]+/g, "");
    return `pricing:${s}|${i}`;
}

// ... helper functions (baseExclusions, buildQuery, extractCandidatePrices, percentile, trim) same as before ...
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
    return `"${t}" #${issue} comic ${baseExclusions()}`;
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
        if (t.includes("variant") || t.includes("virgin") || t.includes("foil") || t.includes("signed")) continue;
        if (/\b9\.\d\b/.test(t)) continue;

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

export async function priceComic({ seriesTitle, issueNumber, year }) {
    const start = Date.now();
    const cacheKey = normalizeKey(seriesTitle, issueNumber);

    // 1. Check Cache (SS-008)
    try {
        const { data } = await supabaseAdmin
            .from('pricing_cache')
            .select('*')
            .eq('key', cacheKey)
            .single();

        if (data) {
            const age = Date.now() - new Date(data.computed_at).getTime();
            if (age < CACHE_TTL_MS) {
                console.log(`[METRICS] type=pricing status=hit key=${cacheKey}`);
                return data.estimate;
            }
        }
    } catch (e) {
        console.warn("Pricing Cache Read Error", e);
    }

    // 2. Compute (Ladder)
    let stage = "none";
    let method = "none";
    let resultValue = { typical: null, soft: null, slabs: null };
    let resultEbay = { imageUrl: null };
    let count = 0;

    const logMetric = (s, m, c) => {
        const duration = Date.now() - start;
        console.log(`[METRICS] type=pricing series="${seriesTitle}" issue="${issueNumber}" stage=${s} method=${m} results=${c} duration=${duration}ms`);
    };

    // A. SOLD STRICT
    if (year && String(year).match(/^(19|20)\d{2}$/)) {
        try {
            const strictQuery = `${seriesTitle} #${issueNumber} ${year} comic`;
            // Redis internal caching for scrapes still applies inside soldComps if enabled, 
            // but we rely on Supabase as the master cache for "Pricing Result"
            const sold = await soldComps({ query: strictQuery, issueNumber });
            if (sold?.raw?.count >= 10) {
                stage = "sold_strict";
                method = "scrape";
                resultValue = {
                    typical: sold.raw.typical ? Math.round(sold.raw.typical) : null,
                    soft: sold.raw.soft ? Math.round(sold.raw.soft) : null,
                    slabs: sold.slabs.typical ? Math.round(sold.slabs.typical) : null,
                };
                count = sold.raw.count;
            }
        } catch (e) { console.warn("Strict Error", e); }
    }

    // B. SOLD RELAXED (if A failed)
    if (stage === "none") {
        try {
            const relaxedQuery = `${seriesTitle} #${issueNumber} comic`;
            const sold = await soldComps({ query: relaxedQuery, issueNumber });
            if (sold?.raw?.count >= 6) {
                stage = "sold_relaxed";
                method = "scrape";
                resultValue = {
                    typical: sold.raw.typical ? Math.round(sold.raw.typical) : null,
                    soft: sold.raw.soft ? Math.round(sold.raw.soft) : null,
                    slabs: sold.slabs.typical ? Math.round(sold.slabs.typical) : null,
                };
                count = sold.raw.count;
            }
        } catch (e) { console.warn("Relaxed Error", e); }
    }

    // C. ACTIVE LISTINGS (if A & B failed)
    if (stage === "none") {
        try {
            const q = buildQuery(seriesTitle, issueNumber);
            const browse = await browseSearch({ q, limit: 50 });
            const { prices, imageUrl, count: activeCount } = extractCandidatePrices(browse, issueNumber);
            if (imageUrl) resultEbay.imageUrl = imageUrl;

            if (activeCount >= 10) {
                stage = "active";
                method = "api";
                const typical = percentile(prices, 0.50);
                const soft = percentile(prices, 0.25);
                resultValue = {
                    typical: typical ? Math.round(typical) : null,
                    soft: soft ? Math.round(soft) : null,
                    slabs: null
                };
                count = activeCount;
            }
        } catch (e) { console.warn("Active Error", e); }
    }

    // 3. Final Result Construction
    const finalResult = {
        value: resultValue,
        ebay: resultEbay,
        meta: { stage, method, count, computed_at: new Date().toISOString() }
    };
    logMetric(stage, method, count);

    // 4. Update Cache (if meaningful result)
    if (stage !== "none") {
        try {
            await supabaseAdmin.from('pricing_cache').upsert({
                key: cacheKey,
                estimate: finalResult,
                computed_at: new Date().toISOString()
            });
        } catch (e) { console.warn("Pricing Cache Write Error", e); }
    }

    return finalResult;
}
