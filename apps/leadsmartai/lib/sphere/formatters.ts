import type { SphereRelationshipType } from "./types";

/**
 * Pure display formatters for sphere data. Kept in a dedicated module so
 * client components can import them without pulling in `lib/sphere/service`
 * — which transitively imports `supabaseAdmin` (a server-only
 * service-role client). The service-role key is unavailable in the
 * client bundle, so `createClient(url, undefined)` throws at module-load
 * time, producing a hydration failure that trips the dashboard error
 * boundary. Re-exported from `service.ts` for server-side callers.
 */

export function currencyFormat(n: number | null): string {
  if (n === null) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toFixed(0)}`;
}

export function percentFormat(n: number | null): string {
  if (n === null) return "—";
  return `${Math.round(n * 100)}%`;
}

export function relationshipLabel(t: SphereRelationshipType): string {
  switch (t) {
    case "past_buyer_client":
      return "Past buyer · client";
    case "past_seller_client":
      return "Past seller · client";
    case "sphere_non_client":
      return "Sphere";
    case "referral_source":
      return "Referrer";
  }
}
