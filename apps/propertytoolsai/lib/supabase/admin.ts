import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "DUMMY_SUPABASE_SERVICE_ROLE_KEY";

/**
 * Service-role Supabase client — **server-only** (API routes, cron, scripts).
 * Never import this into client components.
 */
export const supabaseAdmin = createClient(url, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
