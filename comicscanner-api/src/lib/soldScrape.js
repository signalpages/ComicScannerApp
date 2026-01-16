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
        "lot", "bundle", "set", "run", "collection",
        "tpb", "trade paperback", "graphic novel", "omnibus",
        "facsimile", "reprint",
        "digital", "poster", "print", "cover only", "page", "ad",
        "framed", "ticket"
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

export async function soldComps({ query, cacheKey }) {
    const cached = await redis.get(cacheKey);
    if (cached) return cached;

    const url = new URL("https://www.ebay.com/sch/i.html");
    url.searchParams.set("_nkw", query);
    url.searchParams.set("LH_Sold", "1");
    url.searchParams.set("LH_Complete", "1");

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
    // This is intentionally simple; good enough to restore functionality.
    const titleMatches = [...html.matchAll(/<div class="s-item__title">([\s\S]*?)<\/div>/g)]
        .map(m => m[1].replace(/<[^>]+>/g, "").trim())
        .filter(Boolean);

    const priceMatches = [...html.matchAll(/<span class="s-item__price">([\s\S]*?)<\/span>/g)]
        .map(m => m[1].replace(/<[^>]+>/g, "").trim())
        .map(normalizeMoney)
        .filter(v => v !== null);

    // Pair titles with prices by index heuristics (imperfect but workable)
    const pairs = [];
    const n = Math.min(titleMatches.length, priceMatches.length);
    for (let i = 0; i < n; i++) {
        const title = titleMatches[i];
        const price = priceMatches[i];
        if (!title || price == null) continue;
        if (rejectTitle(title)) continue;
        pairs.push({ title, price, slab: isSlabTitle(title) });
    }

    const raw = trimOutliers(pairs.filter(p => !p.slab).map(p => p.price));
    const slabs = trimOutliers(pairs.filter(p => p.slab).map(p => p.price));

    const rawSorted = raw.slice().sort((a, b) => a - b);
    const slabSorted = slabs.slice().sort((a, b) => a - b);

    const result = {
        raw: {
            soft: percentile(rawSorted, 0.25),
            typical: percentile(rawSorted, 0.50),
            nearMint: percentile(rawSorted, 0.75),
            count: rawSorted.length,
        },
        slabs: {
            typical: percentile(slabSorted, 0.50),
            count: slabSorted.length,
        }
    };

    await redis.set(cacheKey, result, { ex: 60 * 60 * 24 * 7 }); // 7 days
    return result;
}
