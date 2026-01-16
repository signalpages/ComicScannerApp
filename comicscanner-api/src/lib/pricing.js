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

export async function priceComic({ seriesTitle, issueNumber }) {
    const q = buildQuery(seriesTitle, issueNumber);

    // 1) Browse active listings
    const browse = await browseSearch({ q, limit: 50 });
    const { prices, imageUrl, count } = extractCandidatePrices(browse, issueNumber);

    // Only use active listings if we have a decent sample
    const MIN_ACTIVE_SAMPLE = 3;
    const trimmed = trim(prices);

    let typical = trimmed.length >= MIN_ACTIVE_SAMPLE ? percentile(trimmed, 0.50) : null;
    let soft = trimmed.length >= MIN_ACTIVE_SAMPLE ? percentile(trimmed, 0.25) : null;

    // 2) Sold-comps fallback
    let slabs = null;

    // If active listings are thin or missing, or explicitly check sold for better data
    // We always check sold if active is low confidence
    if (!typical || count < 10) {
        const cacheKey = `sold:${seriesTitle}:${issueNumber}`.toLowerCase();
        // Pass issueNumber to soldComps for strict checking
        const sold = await soldComps({ query: `${seriesTitle} #${issueNumber} comic`, cacheKey, issueNumber });
        typical = sold?.raw?.typical ?? typical;
        soft = sold?.raw?.soft ?? soft;
        slabs = sold?.slabs?.typical ?? null;
    }

    return {
        value: {
            typical: typical ? Math.round(typical) : null,
            soft: soft ? Math.round(soft) : null,
            slabs: slabs ? Math.round(slabs) : null,
        },
        ebay: {
            imageUrl: imageUrl || null,
        }
    };
}
