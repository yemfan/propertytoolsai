import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Browser Supabase client (anon key). Use for auth and RLS-protected reads in client components.
 * For server-only writes with elevated privileges, use `@/lib/supabaseServer`.
 */
export const supabase: SupabaseClient = createClient(
  url ?? "",
  anon ?? ""
);
