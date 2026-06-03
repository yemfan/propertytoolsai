/**
 * Pure, client-safe host → pack / Supabase-connection mapping (NO next/headers,
 * so middleware and browser code can import it too). The server-only,
 * headers()-based resolvers live in `lib/packs.ts`.
 */

/**
 * Subdomain -> pack id. The medical (DoctorSmart AI) vertical answers on either
 * `doctor.*` (production brand, e.g. doctor.helmsmart.ai) or `medical.*`
 * (dev / internal, e.g. medical.localhost); everything else is HelmSmart.
 * Add a vertical here when its subdomain goes live.
 */
export function packIdForHost(host: string): string {
  const sub = host.split(":")[0].split(".")[0];
  return sub === "doctor" || sub === "medical" ? "medical" : "helm";
}

/** A per-vertical Supabase connection (URL + public anon key). */
export interface PackConn {
  url: string;
  key: string;
}

/** The medical (DoctorSmart AI) Supabase, from inlined public env. Undefined if unset. */
export function medicalConn(): PackConn | undefined {
  const url = process.env.NEXT_PUBLIC_MEDICAL_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_MEDICAL_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : undefined;
}

/** Connection override for a host, or undefined to use the Core default. */
export function connForHost(host: string): PackConn | undefined {
  return packIdForHost(host) === "medical" ? medicalConn() : undefined;
}

/** The Core (HelmSmart) Supabase, from inlined public env. */
export function coreConn(): PackConn {
  return {
    url: (process.env.NEXT_PUBLIC_HELM_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SMBAI_SUPABASE_URL)!,
    key: (process.env.NEXT_PUBLIC_HELM_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SMBAI_SUPABASE_ANON_KEY)!,
  };
}

/**
 * Full browser Supabase connection for a host — medical on medical.*, else Core.
 * Client components call this with window.location.host so realtime subscriptions
 * hit the SAME project the session belongs to (no cross-vertical websocket retries).
 */
export function browserConnForHost(host: string): PackConn {
  return connForHost(host) ?? coreConn();
}
