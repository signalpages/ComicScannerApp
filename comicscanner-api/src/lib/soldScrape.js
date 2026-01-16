import { redis } from "./redis";

function normalizeMoney(str) {
    const m = str.replace(/[^\d.]/g, "");
    const v = Number(m);
    return Number.isFinite(v) ? v : null;
}

function isSlabTitle(title) {
    const t = title.toLowerCase();
    return t.includes("cgc") || t.includes("cbcs") || t.includes("graded") || t.includes("slab");
}

function rejectTitle(title) {
    const t = title.toLowerCase();
    const bad = [
        "lot", "bundle", "set", "run", "collection", "pack",
        "tpb", "trade paperback", "graphic novel", "omnibus",
        "facsimile", "reprint", "re-print", "golden record",
        "digital", "poster", "print", "cover only", "page", "ad",
        "framed", "ticket", "sticker", "magnet", "funko", "pop"
    ];
    return bad.some(w => t.includes(w));
}

function trimOutliers(values) {
    const v = values.filter(n => typeof n === "number" && n > 0).sort((a, b) => a - b);
    if (v.length < 5) return v;

    // Drop top/bottom 10%
    const drop = Math.floor(v.length * 0.1);
    return v.slice(drop, v.length - drop);
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

export async function soldComps({ query, cacheKey, issueNumber }) {
    const cached = await redis.get(cacheKey);
    if (cached) return cached;

    const url = new URL("https://www.ebay.com/sch/i.html");
    url.searchParams.set("_nkw", query);
    url.searchParams.set("LH_Sold", "1");
    url.searchParams.set("LH_Complete", "1");
    url.searchParams.set("rt", "nc"); // No correct spelling auto-redirects

    const res = await fetch(url.toString(), {
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; ComicScan/1.0)",
            "Accept": "text/html",
        }
    });

    if (!res.ok) {
        const t = await res.text();
        throw new Error(`Sold scrape failed: ${res.status} ${t.slice(0, 200)}`);
    }

    const html = await res.text();

    // Light parsing: pull item blocks and prices.
    const titleMatches = [...html.matchAll(/<div class="s-item__title">([\s\S]*?)<\/div>/g)]
        .map(m => m[1].replace(/<[^>]+>/g, "").trim())
        .filter(Boolean);

    const priceMatches = [...html.matchAll(/<span class="s-item__price">([\s\S]*?)<\/span>/g)]
        .map(m => m[1].replace(/<[^>]+>/g, "").trim())
        .map(normalizeMoney)
        .filter(v => v !== null);

    const pairs = [];
    const n = Math.min(titleMatches.length, priceMatches.length);

    // Strict Guardrails
    const targetIssue = issueNumber ? String(issueNumber).replace(/^#/, "") : null;

    for (let i = 0; i < n; i++) {
        const title = titleMatches[i];
        const price = priceMatches[i];
        if (!title || price == null) continue;

        // 1. Title Exclusion
        if (rejectTitle(title)) continue;

        // 2. Issue Number Verification (if provided)
        if (targetIssue) {
            // Look for isolated number in title matching start, or #NUMBER, or space NUMBER space
            // Simple heuristic check
            const normTitle = title.toLowerCase().replace(/[^\w#.]/g, " ");
            const issuePatt = new RegExp(`(?:^|\\s|#)${targetIssue}(?:\\s|$)`);
            if (!issuePatt.test(normTitle)) continue;
        }

        pairs.push({ title, price, slab: isSlabTitle(title) });
    }

    // 3. Variant Check for Raw
    // If it's not a slab, reject it if it looks like a variant or has a high numeric grade in title
    const cleanPairs = pairs.filter(p => {
        if (p.slab) return true; // Slabs can represent variants if we just want "slab price"

        const t = p.title.toLowerCase();
        if (t.includes("variant") || t.includes("virgin") || t.includes("foil") ||
            t.includes("exclusive") || t.includes("signed") || t.includes("sketch")) return false;

        // Reject raw books claiming high grades (9.8, 9.6 etc) - likely slab spam or overpriced raw
        if (/\b9\.\d\b/.test(t)) return false;

        return true;
    });

    const raw = trimOutliers(cleanPairs.filter(p => !p.slab).map(p => p.price));
    const slabs = trimOutliers(cleanPairs.filter(p => p.slab).map(p => p.price));

    const rawSorted = raw.slice().sort((a, b) => a - b);
    const slabSorted = slabs.slice().sort((a, b) => a - b);

    // Min sample size threshold
    const MIN_SAMPLE = 3;

    const result = {
        raw: {
            soft: rawSorted.length >= MIN_SAMPLE ? percentile(rawSorted, 0.25) : null,
            typical: rawSorted.length >= MIN_SAMPLE ? percentile(rawSorted, 0.50) : null,
            nearMint: rawSorted.length >= MIN_SAMPLE ? percentile(rawSorted, 0.75) : null,
            count: rawSorted.length,
        },
        slabs: {
            typical: slabSorted.length >= MIN_SAMPLE ? percentile(slabSorted, 0.50) : null,
            count: slabSorted.length,
        }
    };

    await redis.set(cacheKey, result, { ex: 60 * 60 * 24 * 7 }); // 7 days
    return result;
}
