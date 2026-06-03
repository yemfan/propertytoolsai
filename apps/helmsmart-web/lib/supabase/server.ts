// Canonical Supabase access lives in @helm/data; this app seam adds PACK-AWARE
// routing so the medical vertical (DoctorSmart AI) talks to its OWN Supabase
// project. Both the RLS client and the service (RLS-bypass) client resolve the
// pack from the request host -> medical Supabase for medical.* + doctor.*, else Core.
// Cron / cross-pack jobs have no request host, so they iterate packServiceConns()
// via createServiceClientFor() / forEachPackService() instead.
import {
  createClient as createCoreClient,
  createServiceClient as createCoreServiceClient,
} from "@helm/data/server";
import {
  getActivePackSupabase,
  getActivePackServiceConn,
  packServiceConns,
} from "@/lib/packs";
import type { PackConn } from "@/lib/pack-host";

export { packServiceConns };

/** RLS-enforced, request-scoped client. Host-aware: medical.* + doctor.* -> medical, else Core. */
export async function createClient() {
  return createCoreClient(await getActivePackSupabase());
}

/** RLS-BYPASS service client. Host-aware: medical.* + doctor.* -> medical, else Core.
 *  Now async — call sites must `await`. */
export async function createServiceClient() {
  return createCoreServiceClient(await getActivePackServiceConn());
}

/** Service client for an EXPLICIT pack connection — for cron / cross-pack jobs that
 *  have no request host. Pass a conn from packServiceConns(); undefined = Core. */
export function createServiceClientFor(conn: PackConn | undefined) {
  return createCoreServiceClient(conn);
}

/** Run `fn` once per configured pack (Core + medical, …) with that pack's service
 *  client, returning each result. Cron jobs use this to process every vertical's orgs. */
export async function forEachPackService<T>(
  fn: (db: ReturnType<typeof createCoreServiceClient>) => Promise<T>,
): Promise<T[]> {
  const results: T[] = [];
  for (const conn of packServiceConns()) {
    results.push(await fn(createServiceClientFor(conn)));
  }
  return results;
}
