
import { supabase } from './supabase.js';

export const resolveComicMetadata = async (title, issue) => {
    // 1. Check Supabase Cache
    const { data: cached, error } = await supabase
        .from('comic_metadata')
        .select('*')
        .eq('title', title) // Note: Needs exact match or fuzzy search logic
        .eq('issue', issue)
        .single();

    if (cached) {
        return cached;
    }

    // 2. Fallback to ComicVine (via Fetch)
    // Note: Reusing the logic from frontend service but adapted for Edge
    const API_KEY = process.env.VITE_COMIC_VINE_KEY; // OR standard ENV
    if (!API_KEY) return null;

    try {
        const searchUrl = `https://comicvine.gamespot.com/api/search/?api_key=${API_KEY}&format=json&resources=issue&query=${encodeURIComponent(`${title} ${issue}`)}&limit=1`;
        const resp = await fetch(searchUrl, { headers: { 'User-Agent': 'ComicScanner/1.0' } });
        const data = await resp.json();

        if (!data.results || data.results.length === 0) return null;

        const result = data.results[0];

        // 3. Store in Supabase
        const metadata = {
            title: result.volume.name,
            issue: result.issue_number,
            publisher: 'Unknown', // Need deeper fetch for publisher usually
            cover_date: result.cover_date,
            comic_vine_id: result.id,
            variants_json: [], // Need deeper fetch
            last_updated: new Date().toISOString()
        };

        // Async write to Supabase (fire and forget on Edge? Or await?)
        // Better to await to ensure cache is hot
        await supabase.from('comic_metadata').upsert(metadata);

        return metadata;

    } catch (e) {
        console.error("Metadata Resolve Error", e);
        return null;
    }
};
