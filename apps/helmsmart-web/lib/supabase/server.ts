// Canonical Supabase access lives in @helm/data; this app seam adds PACK-AWARE
// routing so the medical vertical (DoctorSmart AI) talks to its OWN Supabase
// project. createClient (RLS, request-scoped) resolves the pack from the request
// host -> medical Supabase for medical.*, else Core. createServiceClient stays
// Core for now: it runs in non-request contexts (cron/webhooks) that have no
// host to resolve a pack from (pack-aware service routing is Slice 3).
import { createClient as createCoreClient } from "@helm/data/server";
import { getActivePackSupabase } from "@/lib/packs";

export { createServiceClient } from "@helm/data/server";

export async function createClient() {
  return createCoreClient(await getActivePackSupabase());
}
