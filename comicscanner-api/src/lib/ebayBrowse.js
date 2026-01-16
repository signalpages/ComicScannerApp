import { getEbayAccessToken } from "./ebayAuth";

const MARKETPLACE = process.env.EBAY_MARKETPLACE_ID || "EBAY_US";

export async function browseSearch({ q, limit = 50 }) {
    const token = await getEbayAccessToken();

    const url = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
    url.searchParams.set("q", q);
    url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 200)));
    // Sorting by "bestMatch" tends to be more stable than price-sorted noise
    // url.searchParams.set("sort", "bestMatch");

    const res = await fetch(url.toString(), {
        headers: {
            "Authorization": `Bearer ${token}`,
            "X-EBAY-C-MARKETPLACE-ID": MARKETPLACE,
            "Accept": "application/json",
        },
    });

    if (!res.ok) {
        const t = await res.text();
        throw new Error(`Browse search failed: ${res.status} ${t}`);
    }

    return res.json();
}
