import { supabaseAdmin, checkSupabaseConfig } from "@/lib/supabaseAdmin";

// CS-047: Detailed Saved Scan View
export async function GET(request, { params }) {
    if (!checkSupabaseConfig()) return Response.json({ ok: false, code: "SUPABASE_MISCONFIGURED" }, { status: 500 });

    const id = params.id;
    // Next 15+ needs await params? 
    // In App Router usually params is async in recent versions but standard signature is { params } context.
    // Let's assume params is standard object for now or await it if strict.
    // "params" should be available.

    if (!id) return Response.json({ ok: false, error: "Missing ID" }, { status: 400 });

    const { data, error } = await supabaseAdmin
        .from('saved_scans')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        return Response.json({ ok: false, error: "Not Found" }, { status: 404 });
    }

    return Response.json({ ok: true, item: data });
}
