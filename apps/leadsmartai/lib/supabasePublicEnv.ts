/**
 * Validates the anon Supabase credentials used by browser + cookie SSR clients.
 * @see https://supabase.com/dashboard/project/_/settings/api
 */
export function getSupabasePublicEnv(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function requireSupabasePublicEnv(): { url: string; anonKey: string } {
  const env = getSupabasePublicEnv();
  if (!env) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy apps/leadsmartai/.env.example to .env.local in this app, then paste Project URL + anon public API key from Supabase → Project Settings → API: https://supabase.com/dashboard/project/_/settings/api"
    );
  }
  return env;
}
