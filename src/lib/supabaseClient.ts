// CaseBuddy AI — single shared Supabase client.
// Auth, case cloud-sync, and anything else touching Supabase must import
// this instance (not call createClient again) so there's exactly one
// auth session/listener for the whole app.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
try {
  const url = process.env.REACT_APP_SUPABASE_URL;
  const key = process.env.REACT_APP_SUPABASE_ANON_KEY;
  if (url && key && key !== 'your_anon_key_here') client = createClient(url, key);
} catch {
  client = null;
}

export const supabase = client;
export const supabaseConfigured = !!client;
