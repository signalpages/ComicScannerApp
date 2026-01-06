import jpeg from 'jpeg-js';
import { bmvbhash } from 'blockhash-core';
import { redis } from './_services/redis.js';
import { resolveComicMetadata } from './_services/metadataService.js';

export const config = {
    runtime: 'edge', 
};

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get('image');

        if (!file) {
            return new Response('No image uploaded', { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        
        // 1. Existing Image Hashing (for Hot Cache)
        const rawData = jpeg.decode(arrayBuffer, { useTArray: true });
        const hash = bmvbhash(rawData.data, rawData.width, rawData.height);
        const cacheKey = `phash:${hash}`;
        const cachedId = await redis.get(cacheKey);

        if (cachedId) {
            return new Response(JSON.stringify({ identified: true, cacheHit: true, comicId: cachedId }), { status: 200 });
        }

        // 2. Integration: Call Ximilar Comics Identification
        // Convert arrayBuffer to Base64 for Ximilar
        const base64Image = Buffer.from(arrayBuffer).toString('base64');
        
        const ximilarResponse = await fetch('https://api.ximilar.com/collectibles/v2/comics_id', {
            method: 'POST',
            headers: {
                'Authorization': `Token ${process.env.XIMILAR_TOKEN}`, // Securely pull from Vercel
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "records": [{ "_base64": base64Image }],
                "pricing": true // Returns market data automatically
            })
        });

        const ximilarData = await ximilarResponse.json();
        const identification = ximilarData.records?.[0]?._objects?.[0]?._identification;

        if (!identification) {
            return new Response(JSON.stringify({ identified: false, error: 'Could not identify comic' }), { status: 404 });
        }

        // 3. Resolve Metadata and Cache the Result
        const metadata = await resolveComicMetadata(identification.series, identification.issue_number);
        
        if (metadata && metadata.comic_vine_id) {
            await redis.set(cacheKey, metadata.comic_vine_id, { ex: 86400 });
        }

        return new Response(JSON.stringify({
            identified: true,
            cacheHit: false,
            data: {
                ...identification,
                ...metadata
            }
        }), { status: 200 });

    } catch (e) {
        console.error("Identify Error", e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}