import { NextResponse } from "next/server";
import { priceComic } from "../_services/ebayService"; 
// ^^^ this MUST be whatever you are already using for pricing
// Do NOT change your pricing logic — just import it.

export const runtime = "nodejs";

function extractImageUrl(item) {
  return (
    item?.image?.imageUrl ||
    item?.imageUrl ||
    item?.primaryImageUrl ||
    item?.thumbnailUrl ||
    item?.galleryURL ||
    item?.galleryUrl ||
    (Array.isArray(item?.pictureURL) ? item.pictureURL[0] : null) ||
    null
  );
}

function extractItemUrl(item) {
  return (
    item?.itemWebUrl ||
    item?.itemUrl ||
    item?.viewItemURL ||
    item?.url ||
    null
  );
}

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      seriesTitle,
      issueNumber,
      editionId,
      device_id,
      deviceId
    } = body;

    const device = device_id || deviceId;
    if (!device) {
      return NextResponse.json(
        { ok: false, error: "missing_device_id" },
        { status: 400 }
      );
    }

    // 🔑 THIS IS YOUR EXISTING WORKING PRICING
    const pricing = await priceComic({
      seriesTitle,
      issueNumber,
      editionId,
      device_id: device,
    });

    if (!pricing?.ok) {
      return NextResponse.json(
        { ok: false, error: pricing?.error || "Pricing failed" },
        { status: 502 }
      );
    }

    // Try to locate the “best” eBay item
    const bestItem =
      pricing.bestItem ||
      pricing.item ||
      pricing.ebayItem ||
      pricing.items?.[0] ||
      pricing.comps?.[0] ||
      null;

    const imageUrl = extractImageUrl(bestItem);
    const itemUrl = extractItemUrl(bestItem);

    return NextResponse.json({
      ...pricing,
      ebay: {
        itemUrl,
        imageUrl,
      },
    });
  } catch (err) {
    console.error("price route error:", err);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 }
    );
  }
}
