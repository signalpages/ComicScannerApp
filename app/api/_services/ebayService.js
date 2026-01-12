// src/app/api/_services/ebayService.js
import { getEbayToken } from "./ebayToken.js";

const calculatePercentiles = (prices) => {
  if (!prices || prices.length === 0) return { poor: 0, typical: 0, nearMint: 0 };

  const sorted = [...prices].sort((a, b) => a - b);
  const n = sorted.length;

  const getP = (p) => {
    const index = Math.floor((n - 1) * p);
    return sorted[index];
  };

  return {
    poor: getP(0.25),
    typical: getP(0.5),
    nearMint: getP(0.75),
  };
};

const norm = (s = "") =>
  (s || "")
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9#\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isCardJunk = (title = "") => {
  const t = norm(title);
  return [
    "pokemon",
    "yugioh",
    "yu gi oh",
    "mtg",
    "magic",
    "magic the gathering",
    "trading card",
    "tcg",
    "psa",
    "bgs",
    "sgc",
    "graded",
    "slab",
    "booster",
    "pack",
    "deck",
    "lot",
    "bundle",
    "set",
    "cards",
    "card",
  ].some((w) => t.includes(w));
};

const extractImageUrl = (item) =>
  item?.image?.imageUrl ||
  item?.imageUrl ||
  item?.primaryImageUrl ||
  item?.thumbnailUrl ||
  item?.galleryURL ||
  item?.galleryUrl ||
  (Array.isArray(item?.pictureURL) ? item.pictureURL[0] : null) ||
  null;

/**
 * Parse issue number from the query string.
 * Handles "#23", "issue 23", "no. 23", etc.
 * Falls back to the last numeric token (1-4 digits, optional letter).
 */
const parseIssueFromQuery = (q = "") => {
  const s = norm(q);

  const m =
    s.match(/#\s*(\d{1,4}[a-z]?)/i) ||
    s.match(/\bissue\s+(\d{1,4}[a-z]?)\b/i) ||
    s.match(/\bno\.?\s*(\d{1,4}[a-z]?)\b/i);

  if (m?.[1]) return m[1];

  // Fallback: grab the last plausible numeric token
  const all = s.match(/\b\d{1,4}[a-z]?\b/gi);
  if (!all || all.length === 0) return null;
  return all[all.length - 1];
};

const escapeRegex = (s) =>
  String(s).replace(/[.*+?^()[\]\\|]/g, "\\$&");

const titleHasIssue = (title = "", issue = null) => {
  if (!issue) return true;
  const t = norm(title);
  const n = String(issue).replace(/^#/, "").trim();
  if (!n) return true;

  const re = new RegExp(
    `(^|\\s)(#?${escapeRegex(n)})(\\s|$)|issue\\s+${escapeRegex(n)}|no\\.?\\s*${escapeRegex(n)}`,
    "i"
  );
  return re.test(t);
};

/**
 * Title contamination guard:
 * If the query does NOT include some tokens, reject results that DO include them.
 * This prevents "Spider-Man #23" from accidentally selecting "Ultimate Spider-Man #23".
 */
const rejectContaminatedTitle = (title, query) => {
  const t = norm(title);
  const q = norm(query);

  // If user didn't ask for "ultimate", don't accept titles containing it
  if (!q.includes("ultimate") && t.includes("ultimate")) return true;

  // (Optional) Add more if needed later:
  // if (!q.includes("spectacular") && t.includes("spectacular")) return true;
  // if (!q.includes("amazing") && t.includes("amazing")) return true;
  // if (!q.includes("web of") && t.includes("web of")) return true;

  return false;
};

/**
 * Pick the most likely "real comic" listing for cover art.
 * If we can parse an issue number from the query, REQUIRE the title to match it.
 * Also applies title contamination guards (e.g. "ultimate").
 */
const pickBestCoverItem = (items, query) => {
  const qNorm = norm(query);
  const issue = parseIssueFromQuery(query);

  let best = null;

  for (const item of items || []) {
    const title = item?.title || "";
    if (!title) continue;

    // 1) Kill obvious junk verticals (cards/slabs/TCG/etc.)
    if (isCardJunk(title)) continue;

    // Title contamination guard
    if (rejectContaminatedTitle(title, query)) continue;

    // 2) Require issue match when we have one
    if (!titleHasIssue(title, issue)) continue;

    // 3) Must have an image
    const img = extractImageUrl(item);
    if (!img) continue;

    // 4) Simple similarity scoring
    const tNorm = norm(title);
    let score = 0;

    if (tNorm.includes(qNorm)) score += 0.5;
    if (qNorm.includes(tNorm)) score += 0.3;

    // 5) Penalize bulk-looking listings
    if (tNorm.includes("lot") || tNorm.includes("set") || tNorm.includes("bundle")) score -= 0.4;

    if (!best || score > best.score) best = { item, score };
  }

  // Fallback: if nothing matched with issue constraint, loosen slightly
  // (still avoids card junk + contamination). Prevents blank covers.
  if (!best) {
    for (const item of items || []) {
      const title = item?.title || "";
      if (!title) continue;
      if (isCardJunk(title)) continue;

      // ✅ Title contamination guard (keep in fallback too)
      if (rejectContaminatedTitle(title, query)) continue;

      const img = extractImageUrl(item);
      if (!img) continue;

      const tNorm = norm(title);
      let score = 0;
      if (tNorm.includes(qNorm)) score += 0.35;
      if (qNorm.includes(tNorm)) score += 0.2;
      if (tNorm.includes("lot") || tNorm.includes("set") || tNorm.includes("bundle")) score -= 0.4;

      if (!best || score > best.score) best = { item, score };
    }
  }

  return best?.item || null;
};

export const getEbayMarketPrice = async (query) => {
  try {
    const token = await getEbayToken();

    // Search Active Listings
    // exclude lots, tpb, etc.
    const q = `${query} -lot -set -tpb -hardcover -facsimile -reprint`;

    const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(
      q
    )}&limit=100&sort=price`;

    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      },
    });

    if (!resp.ok) throw new Error("eBay Search Failed");

    const data = await resp.json();
    const items = data.itemSummaries || [];

    // Filter outliers (simple price sanity check, e.g. > $1) + prefer BIN
    const validItems = items.filter((i) => {
      const val = parseFloat(i?.price?.value);
      return val > 1 && (i?.buyingOptions || []).includes("FIXED_PRICE");
    });

    const prices = validItems.map((i) => parseFloat(i.price.value));
    const values = calculatePercentiles(prices);

    // pick best cover item (instead of items[0])
    const bestCoverItem = pickBestCoverItem(items, query);

    return {
      source: "ebay_browse_active_listings",
      coverUrl: extractImageUrl(bestCoverItem),
      firstItemId: bestCoverItem?.itemId || null,
      value: {
        ...values,
        currency: "USD",
      },
      compsCount: prices.length,
    };
  } catch (e) {
    console.error("eBay Service Error", e);
    return {
      source: "error",
      value: { poor: 0, typical: 0, nearMint: 0, currency: "USD" },
      compsCount: 0,
    };
  }
};
