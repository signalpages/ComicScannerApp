import { NextResponse } from "next/server";

export function middleware(request) {
    // CORS Headers
    // We allow "*" origin to support Capacitor (which uses capacitor:// or http://localhost)
    // We explicitly list the headers the client uses.
    const headers = new Headers({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-anon-id, x-dev-bypass, deviceId, x-install-id, x-entitlement-status",
    });

    // Handle simple preflight
    if (request.method === "OPTIONS") {
        return new NextResponse(null, { status: 204, headers });
    }

    // CS-208: Strict Identity Validation
    // Guard critical routes against missing or invalid installId
    const path = request.nextUrl.pathname;

    // List of routes that REQUIRE a valid installId
    const guardedRoutes = [
        "/api/saved-scans",
        "/api/usage",
        // "/api/price", // Price is soft-gated inside route for manual flow (allows null, but warns)
        // "/api/identify", // Identify handles quota internally
    ];

    if (guardedRoutes.some(r => path.startsWith(r))) {
        // Normalization: Header or Query
        const installId =
            request.nextUrl.searchParams.get("installId") ||
            request.headers.get("x-install-id");

        const isValidUUID = installId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(installId);

        if (!isValidUUID) {
            console.warn(`[Middleware] Blocked Request to ${path}: Bad installId='${installId}'`);
            return NextResponse.json(
                { ok: false, code: "BAD_INSTALL_ID", error: "Missing or invalid installId" },
                { status: 400, headers } // valid CORS headers
            );
        }
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
