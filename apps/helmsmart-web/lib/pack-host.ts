/**
 * Pure, client-safe host → pack / Supabase-connection mapping (NO next/headers,
 * so middleware and browser code can import it too). The server-only,
 * headers()-based resolvers live in `lib/packs.ts`.
 */

/** "medical.helmsmart.ai" / "medical.localhost" -> "medical"; everything else -> "helm". */
export function packIdForHost(host: string): string {
  const sub = host.split(":")[0].split(".")[0];
  return sub === "medical" ? "medical" : "helm";
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
