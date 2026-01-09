import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");

  if (!target) return NextResponse.json({ ok: false, error: "Missing url" }, { status: 400 });

  let u;
  try {
    u = new URL(target);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid url" }, { status: 400 });
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return NextResponse.json({ ok: false, error: "Invalid protocol" }, { status: 400 });
  }

  try {
    const upstream = await fetch(u.toString(), {
      redirect: "follow",
      headers: {
        // eBay image CDNs sometimes behave better with browser-ish headers
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        // If eBay host checks referer, this helps; harmless otherwise
        Referer: "https://www.ebay.com/",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return NextResponse.json(
        {
          ok: false,
          error: "upstream_failed",
          status: upstream.status,
          statusText: upstream.statusText,
          contentType: upstream.headers.get("content-type"),
          bodyHead: text.slice(0, 300),
        },
        { status: 502 }
      );
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const buf = Buffer.from(await upstream.arrayBuffer());

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "proxy_exception", message: String(err?.message || err) },
      { status: 502 }
    );
  }
}
