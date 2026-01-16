export async function POST(req) {
    try {
        const body = await req.json().catch(() => null);
        // Optionally: store logs in Redis list or just console
        console.log("client-log:", body);
    } catch { }
    return Response.json({ ok: true });
}
