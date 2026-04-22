import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Automatically clean the URL to prevent /rest/v1 contamination
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
