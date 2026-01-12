// src/app/api/price/route.js
import { NextResponse } from "next/server";
import { getEbayMarketPrice } from "../_services/ebayService";

export const runtime = "nodejs";

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
  ].some((w) => t.includes(w));
}

function looksLikeCardJunkImageUrl(url) {
  const u = (url || "").toLowerCase();
  if (!u) return true;

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
  return Boolean(s) && Boolean(n) && /^[0-9]+[a-z]?$/.test(n);
}

export async function POST(req) {
  try {
    const { getEbayMarketPrice } = await import("../_services/ebayService");
    const body = await req.json().catch(() => ({}));
    const { seriesTitle, issueNumber, editionId, device_id, deviceId } = body;

    // Accept header as fallback (don’t hard fail pricing)
    const device =
      device_id ||
      deviceId ||
      req.headers.get("x-anon-id") ||
      req.headers.get("x-device-id") ||
      null;

    // device is currently not used for pricing; kept for analytics/quota consistency
    void device;

    const title = safeTrim(seriesTitle);
    const issue = safeTrim(issueNumber);
    const query = `${title} ${issue}`.trim();

    const result = await getEbayMarketPrice(query);

    // Never hard-fail UI if eBay fails
    if (!result || result.source === "error") {
      return NextResponse.json(
        {
          ok: true,
          editionId: editionId || null,
          pricing: null,
          ebay: { itemUrl: null, imageUrl: null },
          warning: "EBAY_FAILED",
          ...result,
        },
        { status: 200 }
      );
    }

    // Cover sanity filter (optional but keeps junk out)
    const strict = isProbablyComicIssueQuery(title, issue);

    const itemUrl = buildEbayItemUrl(result.firstItemId);
    let imageUrl = result.coverUrl || null;

    if (strict) {
      if (looksLikeCardJunkQuery(query) || looksLikeCardJunkImageUrl(imageUrl)) {
        imageUrl = null;
      }
    } else {
      if (looksLikeCardJunkImageUrl(imageUrl)) {
        imageUrl = null;
      }
    }

    return NextResponse.json(
      {
        ok: true,
        editionId: editionId || result.editionId || null,
        pricing: result.value ?? null,
        ebay: { itemUrl, imageUrl },
        ...result,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("price route error:", err);
    // Don’t hard-fail UI
    return NextResponse.json(
      {
        ok: true,
        pricing: null,
        ebay: { itemUrl: null, imageUrl: null },
        warning: "SERVER_ERROR",
      },
      { status: 200 }
    );
  }
}
