
import jpeg from 'jpeg-js';
import { bmvbhash } from 'blockhash-core';
import { redis } from './_services/redis.js';
import { resolveComicMetadata } from './_services/metadataService.js';

export const config = {
    runtime: 'edge', // or 'nodejs' if jpeg-js is too slow, but jpeg-js is pure JS so Edge might work (ignoring timeout)
};

const hex = (buffer) => {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
};

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get('image'); // Expecting 'image' field

        if (!file) {
            return new Response('No image uploaded', { status: 400 });
        }

        // 1. Image Processing (Decode & Hash)
        const arrayBuffer = await file.arrayBuffer();
        const rawData = jpeg.decode(arrayBuffer, { useTArray: true }); // Decode JPG

        // pHash Generation (16 bits)
        // blockhash-core expects (data, width, height)
        // Raw data from jpeg-js is RGBA (4 bytes per pixel)
        // We might need to simplify data for blockhash or pass it directly if supported.
        // bmvbhash(data, width, height)
        const hash = bmvbhash(rawData.data, rawData.width, rawData.height);

        // 2. Check Redis Cache (Identity Cache)
        const cacheKey = `phash:${hash}`;
        const cachedId = await redis.get(cacheKey);

        if (cachedId) {
            console.log(`Cache HIT for hash ${hash}`);
            // Fetch metadata for this ID (cached in Supabase or Redis)
            // For now, assume cachedId is sufficient to lookup metadata
            // Real implementation would fetch full details.
            return new Response(JSON.stringify({
                identified: true,
                cacheHit: true,
                comicId: cachedId
            }), { status: 200 });
        }

        // 3. Cache Miss: AI Identification
        console.log(`Cache MISS for hash ${hash}. Calling AI...`);

        // TODO: Call Gemini API here (Ported from frontend aiScanner.js)
        // For V1 Demo, we mock the AI result or assume it identifies 'Spawn #1'
        const aiResult = {
            title: "Spawn",
            issue: "1",
            confidence: 0.98
        };

        // 4. Resolve Metadata (Canonical)
        const metadata = await resolveComicMetadata(aiResult.title, aiResult.issue);

        // 5. Cache the Result
        // Store Hash -> ComicID (24h TTL)
        if (metadata && metadata.comic_vine_id) {
            await redis.set(cacheKey, metadata.comic_vine_id, { ex: 86400 });
        }

        return new Response(JSON.stringify({
            identified: true,
            cacheHit: false,
            data: metadata || aiResult
        }), { status: 200 });

    } catch (e) {
        console.error("Identify Error", e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
