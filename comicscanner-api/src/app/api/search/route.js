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

        return Response.json({
            ok: true,
            candidates,
            backendVersion: process.env.VERCEL_GIT_COMMIT_SHA || "dev"
        });

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
        let title = item.title || "";
        let seriesTitle = title;
        let issueNumber = requestedIssue || null;
        let year = null;

        // CS-026: Parse Title for Series + Issue
        // Regex looks for "Title #Issue" or "Title Issue" patterns
        // Very basic implementation: look for the last #number or just number

        try {
            // 1. Try to extract year (4 digits, 19xx or 20xx)
            const yearMatch = title.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) {
                year = parseInt(yearMatch[0], 10);
                // Remove year from title for cleaner series processing
                title = title.replace(yearMatch[0], "").trim();
            }

            // 2. Try to extract issue number (look for #123 or Vol 1 123 or just 123 at the end of a segment)
            // Prioritize explicit #
            const hashMatch = title.match(/#\s*(\d+(\.\d+)?)/);
            if (hashMatch) {
                issueNumber = hashMatch[1];
                // Series title is likely everything before the hash
                seriesTitle = title.substring(0, hashMatch.index).trim();
            } else {
                // Fallback: look for issue number at end of string if we have a requested issue
                // If the user typed "Spawn 1", and we see "Spawn 1", we can assume 1 is the issue
                if (requestedIssue) {
                    const reRequest = new RegExp(`\\b${requestedIssue}\\b`);
                    if (reRequest.test(title)) {
                        issueNumber = requestedIssue;
                        // Try to strip it out? Maybe too risky. Keep full title as seriesTitle fallback
                    }
                }
            }
        } catch (e) {
            console.warn("Title parsing error", e);
        }

        // Clean up seriesTitle (remove junk)
        seriesTitle = seriesTitle.replace(/\(.*\)/g, "").trim(); // remove parens
        seriesTitle = seriesTitle.replace(/-+$/, "").trim(); // remove trailing dashes behavior

        // Construct clean displayName
        const displayName = issueNumber
            ? `${seriesTitle} #${issueNumber}`
            : seriesTitle;

        return {
            editionId: item.itemId,
            displayName: displayName, // CS-026: Clean display name
            seriesTitle: seriesTitle,
            issueNumber: issueNumber,
            coverUrl: item.image?.imageUrl || null,
            publisher: null,
            year: year,
            marketImageUrl: item.image?.imageUrl || null
        };
    });
}
