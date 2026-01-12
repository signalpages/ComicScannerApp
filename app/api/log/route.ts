export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    console.log("📱 CLIENT LOG", {
      time: new Date().toISOString(),
      ...body,
    });

    return Response.json({ ok: true });
  } catch (e) {
    console.error("log route error", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
