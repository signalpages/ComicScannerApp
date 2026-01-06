import jpeg from 'jpeg-js';
import { bmvbhash } from 'blockhash-core';
import { redis } from './_services/redis.js';
import { resolveComicMetadata } from './_services/metadataService.js';
import { Buffer } from 'node:buffer'; 

export const config = {
    runtime: 'nodejs', // REQUIRED for heavy image processing
};

export default async function handler(req) {
    console.log("!!! API HIT DETECTED !!!");
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    try {
        const formData = await req.formData();
        const file = formData.get('image');
        const arrayBuffer = await file.arrayBuffer();
        
        // 1. Image Hashing (Skipping cache for now to ensure fresh results)
        const rawData = jpeg.decode(arrayBuffer, { useTArray: true });
        const hash = bmvbhash(rawData.data, rawData.width, rawData.height);
        console.log(`Processing Image Hash: ${hash}`);

        // 2. LIVE AI Identification
        const base64Image = Buffer.from(arrayBuffer).toString('base64');
        const ximilarResponse = await fetch('https://api.ximilar.com/collectibles/v2/comics_id', {
            method: 'POST',
            headers: {
                'Authorization': `Token ${process.env.XIMILAR_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "records": [{ "_base64": base64Image }],
                "pricing": true 
            })
        });

        const ximilarData = await ximilarResponse.json();
        const identification = ximilarData.records?.[0]?._objects?.[0]?._identification;
        
        console.log("AI IDENTIFICATION RESULT:", JSON.stringify(identification));

        if (!identification) {
            return new Response(JSON.stringify({ identified: false, error: 'AI failed to identify cover' }), { status: 404 });
        }

        // 3. Resolve Metadata
        const metadata = await resolveComicMetadata(identification.series, identification.issue_number);
        console.log("METADATA RESOLVED:", JSON.stringify(metadata));

        return new Response(JSON.stringify({
            identified: true,
            data: { ...identification, ...metadata }
        }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e) {
        console.error("CRITICAL API ERROR:", e.message);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}