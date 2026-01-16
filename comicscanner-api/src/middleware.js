import { NextResponse } from "next/server";

export function middleware(request) {
    // CORS Headers
    // We allow "*" origin to support Capacitor (which uses capacitor:// or http://localhost)
    // We explicitly list the headers the client uses.
    const headers = new Headers({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-anon-id, x-dev-bypass, deviceId",
    });

    // Handle simple preflight
    if (request.method === "OPTIONS") {
        return new NextResponse(null, { status: 204, headers });
    }

    // Pass headers to the actual response
    const response = NextResponse.next();

    // Apply the same headers to the response so the browser sees them
    headers.forEach((value, key) => {
        response.headers.set(key, value);
    });

    return response;
}

export const config = {
    matcher: "/api/:path*",
};
