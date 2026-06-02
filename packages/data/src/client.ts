import { createBrowserClient } from "@supabase/ssr";

/** RLS-enforced browser client (anon key). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_HELM_SUPABASE_URL ??
      process.env.NEXT_PUBLIC_SMBAI_SUPABASE_URL ??
      "",
    process.env.NEXT_PUBLIC_HELM_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SMBAI_SUPABASE_ANON_KEY ??
      ""
  );
}
