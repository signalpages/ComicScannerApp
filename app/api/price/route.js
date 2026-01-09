import { NextResponse } from "next/server";
import { getEbayMarketPrice } from "../_services/ebayService";
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

    // Construct query for existing service
    const query = `${seriesTitle} ${issueNumber || ''}`.trim();

    // Call existing service
    const result = await getEbayMarketPrice(query);

    // Check if error (service returns { source: 'error' } on failure)
    if (result.source === 'error') {
      return NextResponse.json(
        { ok: false, error: "eBay Search Failed" },
        { status: 502 }
      );
    }

    // Map service result to new response contract
    return NextResponse.json({
      ok: true,
      pricing: result.value,
      ebay: {
        itemUrl: result.firstItemId ? `https://www.ebay.com/itm/${result.firstItemId.split('|')[1] || result.firstItemId}` : null,
        imageUrl: result.coverUrl,
      },
      ...result
    });
  } catch (err) {
    console.error("price route error:", err);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 }
    );
  }
}
