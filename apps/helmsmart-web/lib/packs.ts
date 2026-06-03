import { headers } from "next/headers";
import type { PackManifest } from "@helm/ui";
import { medicalManifest } from "@helm/pack-medical";
import { packIdForHost, connForHost, type PackConn } from "@/lib/pack-host";

/**
 * Active industry-pack resolution (Slice 1).
 *
 * The vertical is a CONFIGURATION dimension, not a route — it's resolved from the
 * request host (subdomain) and applied to the SAME industry-agnostic Core routes.
 *   medical.helmsmart.ai  (or  medical.localhost  in dev)  -> DoctorSmart AI
 *   every other host                                        -> HelmSmart
 * So nothing changes for HelmSmart until the medical subdomain exists — safe to
 * ship before DNS. (Middleware resolution + a `?pack=` override move to Slice 2,
 * when the middleware also routes auth to the per-vertical Supabase.)
 */
const helmManifest: PackManifest = {
  id: "helm",
  productName: "HelmSmart",
  logoLetter: "H",
  dataPack: "helm",
  auth: "shared",
  terms: {},
  tagline: "More control, less effort",
};

const PACKS: Record<string, PackManifest> = {
  helm: helmManifest,
  medical: medicalManifest,
};

/** Resolve the active pack manifest from the request host. Defaults to HelmSmart. */
export async function getActivePack(): Promise<PackManifest> {
  const host = (await headers()).get("host") ?? "";
  return PACKS[packIdForHost(host)] ?? helmManifest;
}

/** Server-side Supabase connection override for the active pack (undefined = Core). */
export async function getActivePackSupabase(): Promise<PackConn | undefined> {
  return connForHost((await headers()).get("host") ?? "");
}
