import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return new NextResponse("Missing url", { status: 400 });
  }

  const res = await fetch(url, {
    headers: {
      // Pretend to be a browser
      "User-Agent": "Mozilla/5.0",
      "Accept": "image/*",
    },
  });

  if (!res.ok) {
    return new NextResponse("Image fetch failed", { status: 404 });
  }

  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buffer = await res.arrayBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
