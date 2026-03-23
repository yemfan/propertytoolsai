import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client: bypasses RLS. Use only on the server (Route Handlers,
 * Server Actions, cron, scripts). Never import from client components.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** True when Supabase URL + service role key are set (server-side support chat persistence). */
export function isSupabaseServiceConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}
