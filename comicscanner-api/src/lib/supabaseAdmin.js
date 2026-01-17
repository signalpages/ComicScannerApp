import { createClient } from '@supabase/supabase-js';

// SS-001: Server-side Supabase Client
// MUST use Service Role Key to bypass RLS (since we don't have user auth)
const supabaseUrl = process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Warn but don't crash immediately, so build passes if vars missing
    console.warn("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY - Using Placeholders");
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// CS-052: Explicit Config Check
export function checkSupabaseConfig() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const isUrlSet = !!url && !url.includes("placeholder");
    const isKeyValid = !!key && !key.includes("placeholder") && key.length > 40;

    console.log(`[Startup] Supabase Config Check: URL=${isUrlSet} KeyValid=${isKeyValid}`);

    if (isUrlSet && isKeyValid) return true;
    return false;
}
