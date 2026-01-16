export async function GET(req) {
    const url = new URL(req.url);
    const title = (url.searchParams.get("title") || "").trim();
    const issue = (url.searchParams.get("issue") || "").trim();

    // Minimal placeholder: client can still use this to show "no results"
    // If you want, we can hook this into eBay browse to suggest candidates.
    if (!title || !issue) {
        return Response.json({ ok: false, code: "BAD_REQUEST", error: "Missing title/issue", candidates: [] }, { status: 400 });
    }

    return Response.json({ ok: true, candidates: [] });
}
