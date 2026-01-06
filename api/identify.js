import jpeg from 'jpeg-js';
import { bmvbhash } from 'blockhash-core';
import { redis } from './_services/redis.js';
import { resolveComicMetadata } from './_services/metadataService.js';
import formidable from 'formidable';
import fs from 'fs/promises';

export const config = {
    api: {
        bodyParser: false, // Disabling bodyParser is required for formidable
    },
};

export default async function handler(req, res) {
    console.log("!!! API HIT DETECTED !!!");
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const form = formidable({});

    try {
        // 1. Parse the Incoming File
        const [fields, files] = await form.parse(req);
        const file = files.image[0];
        const imageBuffer = await fs.readFile(file.filepath);
        
        // 2. Image Hashing
        const rawData = jpeg.decode(imageBuffer, { useTArray: true });
        const hash = bmvbhash(rawData.data, rawData.width, rawData.height);
        console.log(`Processing Hash: ${hash}`);

        // 3. AI Identification (Ximilar)
        const base64Image = imageBuffer.toString('base64');
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
        console.log("AI RESULT:", JSON.stringify(identification));

        if (!identification) {
            return res.status(404).json({ identified: false, error: 'AI failed to identify' });
        }

        // 4. Resolve Metadata
        const metadata = await resolveComicMetadata(identification.series, identification.issue_number);
        
        return res.status(200).json({
            identified: true,
            data: { ...identification, ...metadata }
        });

    } catch (e) {
        console.error("CRITICAL API ERROR:", e.message);
        return res.status(500).json({ error: e.message });
    }
}