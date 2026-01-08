
export const runtime = 'nodejs'; // Use nodejs runtime for compatibility if needed, but edge is preferred if no heavy libs. 
// User requested "Runtime: nodejs" or "edge" where appropriate.
// Proxy logic specifically requested "Runtime: nodejs" in step 877 for robustness or legacy reasons? 
// No, step 877 says "app/api/image/route.js ... Runtime: nodejs". 

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
        return new Response('Missing url param', { status: 400 });
    }

    // Strict URL Validation
    let u;
    try {
        u = new URL(targetUrl);
    } catch {
        return new Response("Invalid url", { status: 400 });
    }

    if (!["http:", "https:"].includes(u.protocol)) {
        return new Response("Invalid protocol", { status: 400 });
    }

    try {
        const imageRes = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'ComicScanner/1.0 (Next.js Proxy)',
                'Accept': 'image/*'
            }
        });

        if (!imageRes.ok) {
            return new Response(`Upstream Error: ${imageRes.status}`, { status: 502 });
        }

        const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
        const body = imageRes.body; // Stream

        return new Response(body, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=86400, s-maxage=86400',
            },
        });

    } catch (e) {
        console.error("Proxy Error:", e);
        return new Response('Internal Server Error', { status: 500 });
    }
}
