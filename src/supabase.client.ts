import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_API_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Supabase credentials are not set in environment variables',
      );
    }
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}
