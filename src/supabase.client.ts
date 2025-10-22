import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;

function resolveSupabaseUrl(url?: string): string {
  if (!url) return '';
  let out = url.trim();
  if (!/^https?:\/\//i.test(out)) {
    out = `https://${out}`; // allow users to set without protocol
  }
  return out;
}

export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    const supabaseUrlRaw = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_API_KEY;
    const supabaseUrl = resolveSupabaseUrl(supabaseUrlRaw);

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Supabase credentials are not set in environment variables (SUPABASE_URL, SUPABASE_API_KEY).',
      );
    }
    if (!/\.supabase\.co$/i.test(new URL(supabaseUrl).host)) {
      throw new Error(
        `SUPABASE_URL must be your project base URL (e.g., https://<ref>.supabase.co). Got: ${supabaseUrl}`,
      );
    }
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

export function getSupabaseBucket(): string {
  const bucket = process.env.SUPABASE_BUCKET;
  if (!bucket) throw new Error('SUPABASE_BUCKET not set');
  return bucket;
}
