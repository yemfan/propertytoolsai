import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "DUMMY_SUPABASE_SERVICE_ROLE_KEY";
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Returns the service-role client, creating it on first use so `process.env` is read **after**
 * loaders like `dotenv` run in CLI scripts (static `createClient` at module load would miss `.env.local`).
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createServiceClient();
  }
  return _admin;
}

/**
 * Service-role Supabase client — **server-only** (API routes, cron, scripts).
 * Never import this into client components.
 *
 * Lazily delegates to {@link getSupabaseAdmin} on each property access.
 */
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin();
    const value = Reflect.get(client, prop);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});

export function isSupabaseServiceConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}
