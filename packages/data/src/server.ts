import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// HelmSmart Core DB. Env names support the SMBAI->HELM transition (deferred rename):
// prefer NEXT_PUBLIC_HELM_*, fall back to the current NEXT_PUBLIC_SMBAI_*.
const CORE_URL = "https://vpmwsnoosuiknyzdxgtk.supabase.co";

function url(): string {
  return (
    process.env.NEXT_PUBLIC_HELM_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SMBAI_SUPABASE_URL ??
    CORE_URL
  );
}

function anonKey(): string {
  return (
    process.env.NEXT_PUBLIC_HELM_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SMBAI_SUPABASE_ANON_KEY ??
    ""
  );
}

/**
 * RLS-enforced server client bound to the request's cookies.
 * This is the DEFAULT for all user-facing reads/writes — every query runs as the
 * signed-in user and is scoped by get_user_org_ids() / get_user_scope().
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(url(), anonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — middleware refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Service-role client that BYPASSES RLS. Restricted use only: webhooks, cron, and
 * admin paths (see the service-role lint allowlist). Never use for user-facing actions —
 * use createClient() so RLS enforces tenant isolation.
 */
export function createServiceClient() {
  const serviceKey =
    process.env.HELM_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SMBAI_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "";
  return createServerClient(url(), serviceKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
