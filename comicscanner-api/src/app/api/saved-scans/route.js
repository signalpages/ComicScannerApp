import { supabaseAdmin, checkSupabaseConfig } from "@/lib/supabaseAdmin";

// SS-007: Saved Scans API

import { normalizeCandidate } from "@/lib/normalization";

export async function POST(req) {
    if (!checkSupabaseConfig()) {
        return Response.json({ ok: false, code: "SUPABASE_MISCONFIGURED", error: "Back-end misconfigured" }, { status: 500 });
    }

    const body = await req.json();
    const {
        installId,
        selectedCandidate,
        scanThumb,
        confidence,
        ebayQuery,
        pricing
    } = body;

    // CS-302: Trust Header First (if middleware validated it)
    let effectiveInstallId = installId;
    const headerId = req.headers.get("x-install-id");

    // If header exists and is valid, prefer it (or ensure match)
    // Middleware CS-208 already guards this route for validity.
    if (headerId) effectiveInstallId = headerId;

    if (!effectiveInstallId || !selectedCandidate) {
        return Response.json({ ok: false, error: "Missing required fields" }, { status: 400 });
    }

    // CS-054: Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(effectiveInstallId)) {
        console.warn(`[WARN] bad_install_id: ${effectiveInstallId}`);
        return Response.json({ ok: false, code: "BAD_INSTALL_ID", error: "Invalid Install ID format" }, { status: 400 });
    }

    // CS-046: Normalize Data
    const cleanData = normalizeCandidate(selectedCandidate);

    // CS-201: Extract pricing flat fields for list performance
    const pricingVal = pricing?.value || {};
    const pricingLow = pricingVal.low || null;
    const pricingTyp = pricingVal.typical || null;
    const pricingHigh = pricingVal.high || null;
    const pricingCur = pricingVal.currency || "USD";

    // CS-201: eBay Sold URL
    let ebaySoldUrl = null;
    if (cleanData.seriesTitle && cleanData.issueNumber) {
        const query = `${cleanData.seriesTitle} #${cleanData.issueNumber} comic`;
        ebaySoldUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`;
    }

    const { data, error } = await supabaseAdmin
        .from('saved_scans')
        .insert({
            install_id: effectiveInstallId, // Clean from body or header (already validated UUID)
            // CS-046: Use normalized fields
            display_name: cleanData.displayName || selectedCandidate.displayName || "Unknown Comic",
            series_title: cleanData.seriesTitle,
            issue_number: cleanData.issueNumber,
            publisher: cleanData.publisher,
            year: cleanData.year,
            confidence: confidence,
            cover_url: cleanData.coverUrl || selectedCandidate.coverUrl,

            scan_thumb_url: scanThumb && scanThumb.startsWith('http') ? scanThumb : null,
            scan_thumb_base64: scanThumb && scanThumb.startsWith('data:') ? scanThumb : null,

            // CS-201 New Columns
            pricing_low: pricingLow,
            pricing_typical: pricingTyp,
            pricing_high: pricingHigh,
            pricing_currency: pricingCur,
            ebay_sold_url: ebaySoldUrl,

            ebay_query: ebayQuery,
            raw_candidate: selectedCandidate,
            raw_pricing: pricing
        })
        .select('id')
        .single();

    if (error) {
        console.error("Save Error", error);
        return Response.json({ ok: false, error: "Failed to save scan" }, { status: 500 });
    }

    return Response.json({ ok: true, id: data.id });
}

export async function GET(req) {
    if (!checkSupabaseConfig()) {
        return Response.json({ ok: false, code: "SUPABASE_MISCONFIGURED", error: "Back-end misconfigured" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    // Strict contract Rule 1
    const installId = searchParams.get('installId') || req.headers.get('x-install-id');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!installId) {
        return Response.json({ ok: false, error: "Missing installId" }, { status: 400 });
    }

    // CS-054: Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(installId)) {
        return Response.json({ ok: true, items: [] }); // Soft fail for GET: just return empty list
    }

    const { data, error } = await supabaseAdmin
        .from('saved_scans')
        .select('*')
        .eq('install_id', installId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error("Fetch Error", error);
        return Response.json({ ok: false, error: "Failed to fetch history" }, { status: 500 });
    }

    return Response.json({ ok: true, items: data });
}
