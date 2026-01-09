// src/app/api/price/route.js
import { NextResponse } from "next/server";
import { getEbayMarketPrice } from "../_services/ebayService";

export const runtime = "nodejs";

/**
 * This route keeps your existing pricing logic intact (getEbayMarketPrice)
 * and only applies a pragmatic "cover sanity" filter so we stop showing
 * trading cards / random junk as comic covers.
 */

function safeTrim(s) {
  return (s || "").toString().trim();
}

function buildEbayItemUrl(firstItemId) {
  if (!firstItemId) return null;
  const raw = String(firstItemId);
  const maybeId = raw.includes("|") ? raw.split("|")[1] : raw;
  return `https://www.ebay.com/itm/${maybeId}`;
}

function looksLikeCardJunkQuery(q) {
  const t = (q || "").toLowerCase();
  return [
    "pokemon",
    "yugioh",
    "yu-gi-oh",
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
s,
  ].some((w) => t.includes(w));
}

function looksLikeCardJunkImageUrl(url) {
  const u = (url || "").toLowerCase();
  if (!u) return true; // if missing, treat as not-usable

  const badHints = [
    "pokemon",
    "yugioh",
    "mtg",
    "magic",
    "tcg",
    "tradingcard",
    "trading-card",
    "psa",
    "bgs",
    "sgc",
    "graded",
    "slab",
  ];
  return badHints.some((h) => u.includes(h));
}

function isProbablyComicIssueQuery(seriesTitle, issueNumber) {
  const s = safeTrim(seriesTitle);
  const n = safeTrim(issueNumber).replace(/^#/, "");
  // Basic: series title + numeric-ish issue => likely comic
  return Boolean(s) && Boolean(n) && /^[0-9]+[a-z]?$/.test(n);
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    const { seriesTitle, issueNumber, editionId, device_id, deviceId } = body;

    const device = device_id || deviceId;
    if (!device) {
      return NextResponse.json(
        { ok: false, error: "missing_device_id" },
        { status: 400 }
      );
    }

    const title = safeTrim(seriesTitle);
    const issue = safeTrim(issueNumber);

    if (!title) {
      return NextResponse.json(
        { ok: false, error: "missing_series_title" },
        { status: 400 }
      );
    }

    // Keep your existing service usage
    const query = `${title} ${issue}`.trim();
    const result = await getEbayMarketPrice(query);

    if (!result || result.source === "error") {
      return NextResponse.json(
        { ok: false, error: "eBay Search Failed" },
        { status: 502 }
      );
    }

    // Build item url the same way you already were
    const itemUrl = buildEbayItemUrl(result.firstItemId);

    // ✅ Cover sanity: only accept coverUrl if it doesn't look like card junk
    const strict = isProbablyComicIssueQuery(title, issue);

    let imageUrl = result.coverUrl || null;

    if (strict) {
      if (looksLikeCardJunkQuery(query) || looksLikeCardJunkImageUrl(imageUrl)) {
        imageUrl = null;
      }
    } else {
      // Non-strict: still block obvious nonsense if url is clearly "card/graded"
      if (looksLikeCardJunkImageUrl(imageUrl)) {
        imageUrl = null;
      }
    }

    // Return your existing contract + keep extra fields from result
    return NextResponse.json({
      ok: true,
      editionId: editionId || result.editionId || null,
      pricing: result.value ?? null,
      ebay: {
        itemUrl,
        imageUrl,
      },
      ...result,
    });
  } catch (err) {
    console.error("price route error:", err);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 }
    );
  }
}
