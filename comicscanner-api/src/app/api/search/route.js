import { browseSearch } from "@/lib/ebayBrowse";

// Copy of excluded keywords from pricing.js to ensure we find "clean" candidates if possible
function baseExclusions() {
    return [
        "-lot", "-bundle", "-set", "-run", "-collection",
        "-tpb", "-hardcover", "-omnibus", "-graphic", "-paperback",
        "-facsimile", "-reprint", "-digital",
        "-poster", "-print", "-framed", "-ticket",
        "-cover only", "-page", "-signed", "-sketch", "-variant", "-virgin", "-foil"
    ].join(" ");
}

export async function GET(req) {
    const url = new URL(req.url);
    const title = (url.searchParams.get("title") || "").trim();
    const issue = (url.searchParams.get("issue") || "").trim();

    if (!title) {
        return Response.json({ ok: false, code: "BAD_REQUEST", error: "Missing title", candidates: [] }, { status: 400 });
    }

    // 1. Primary Search (Strict)
    let q = `"${title}"`;
    if (issue) q += ` #${issue}`;
    q += ` comic ${baseExclusions()}`;

    console.log(`[METRICS] type=search query='${q}' attempt=1`);

    let candidates = [];

    try {
        const res = await browseSearch({ q, limit: 20 });
        candidates = mapItemsToCandidates(res?.itemSummaries, issue);

        if (candidates.length === 0) {
            // 2. Retry Logic (Loose) - Remove exclusions and strict issue formatting
            // Try just "Title Issue comic" without quotes or hash or exclusions
            const looseQ = `${title} ${issue} comic`;
            console.log(`[METRICS] type=search query='${looseQ}' attempt=2 reason=empty`);
            const retryRes = await browseSearch({ q: looseQ, limit: 20 });
            candidates = mapItemsToCandidates(retryRes?.itemSummaries, issue);
        }

        console.log(`[METRICS] type=search status=success results=${candidates.length}`);

        // If still 0, client will show "No matches found", but we tried our best.
        // We could define a dedicated error if needed, but empty list is standard "No matches".

        return Response.json({ ok: true, candidates });

    } catch (error) {
        console.error("Search API Error:", error);
        console.log(`[METRICS] type=search status=error error='${error.message}'`);
        // Return soft failure
        return Response.json({ ok: false, error: "SEARCH_PROVIDER_ERROR" });
    }
}

function mapItemsToCandidates(items, requestedIssue) {
    if (!items || !Array.isArray(items)) return [];

    return items.map(item => {
        // Basic mapping. In a perfect world we'd parse the title to extract "real" series/issue.
        // For now, we trust the user's manual input or the item title.

        // If the item title contains the requested issue, likely a match.
        // We accept the item as a candidate.

        return {
            editionId: item.itemId, // Use eBay Item ID as temp ID
            displayName: item.title,
            seriesTitle: item.title, // Use full title as series title to ensure next step uses it all
            issueNumber: requestedIssue || null, // Best guess
            coverUrl: item.image?.imageUrl || null,
            publisher: null,
            year: null, // Hard to extract reliably without regex parsing
            marketImageUrl: item.image?.imageUrl || null
        };
    });
}
