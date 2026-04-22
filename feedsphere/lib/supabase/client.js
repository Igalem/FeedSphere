import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    console.error('🚀 FeedSphere Debug: Supabase keys are MISSING in the browser!');
    console.log('URL defined:', !!url, 'Anon defined:', !!anon);
  } else {
    console.log('🚀 FeedSphere Debug: Supabase keys are present.');
  }

  return createBrowserClient(url, anon);
}
