import { supabaseAdmin, checkSupabaseConfig } from "@/lib/supabaseAdmin";

export async function GET(req, { params }) {
    if (!checkSupabaseConfig()) {
        return Response.json({ ok: false, error: "Back-end misconfigured" }, { status: 500 });
    }

    const { id } = params;
    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || !uuidRegex.test(id)) {
        return Response.json({ ok: false, error: "Invalid ID" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
        .from('saved_scans')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !data) {
        return Response.json({ ok: false, error: "Scan not found" }, { status: 404 });
    }

    return Response.json({ ok: true, item: data });
}
