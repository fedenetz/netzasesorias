import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && publishableKey);
export const supabase = isSupabaseConfigured ? createClient(url, publishableKey) : null;

const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

export async function signInWithGoogle(returnPath = '/control') {
  if (!supabase) throw new Error('Supabase no está configurado.');
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}${returnPath}`,
      scopes: GOOGLE_DRIVE_SCOPE,
      queryParams: { access_type: 'online', include_granted_scopes: 'true' },
    },
  });
}

export async function connectGoogleDrive() {
  return signInWithGoogle(`${window.location.pathname}${window.location.search}`);
}
