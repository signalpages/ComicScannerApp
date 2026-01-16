export async function POST() {
    return Response.json({
        ok: true,
        plan: { tier: "free" }
    });
}
