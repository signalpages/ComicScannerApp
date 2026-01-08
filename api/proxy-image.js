
export const config = {
    runtime: 'edge', // Use Edge for speed
};

export default async function handler(req) {
    const url = new URL(req.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
        return new Response('Missing url param', { status: 400 });
    }

    try {
        // Fetch the remote image
        const imageRes = await fetch(targetUrl, {
            headers: {
                // Mimic a standard browser request or generic
                'User-Agent': 'ComicScanner/1.0',
            }
        });

        if (!imageRes.ok) {
            return new Response(`Failed to fetch image: ${imageRes.status}`, { status: 502 });
        }

        const contentType = imageRes.headers.get('content-type');
        const body = imageRes.body;

        // Return with CORS headers and correct content type
        return new Response(body, {
            status: 200,
            headers: {
                'Content-Type': contentType || 'image/jpeg',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=86400, mutable', // Cache for 1 day
                // "nosniff" helps prevent some mime-confusion but ORB blocks opaque.
                // By proxying, the response is now SAME-ORIGIN (from the app's perspective),
                // so ORB checks are relaxed for text/html vs image, but this is an image.
            }
        });
    } catch (e) {
        return new Response('Image fetch error', { status: 500 });
    }
}
