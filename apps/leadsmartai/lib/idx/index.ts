import "server-only";

import { rentcastIdxAdapter } from "@/lib/idx/rentcastAdapter";
import type { IdxAdapter } from "@/lib/idx/types";

export type {
  IdxAdapter,
  IdxAdapterError,
  IdxAdapterFailure,
  IdxAdapterResult,
  IdxAdapterSuccess,
  IdxListingDetail,
  IdxListingStatus,
  IdxListingSummary,
  IdxPropertyType,
  IdxSearchFilters,
  IdxSearchResult,
} from "@/lib/idx/types";

export { isIdxFailure, isIdxSuccess } from "@/lib/idx/types";

/**
 * Resolve the active IDX provider for this request. Today: Rentcast (demo
 * provider). Future: switch by agent / brokerage / market — once a serious
 * customer signs onto MLS Grid or IDX Broker we'll branch here on
 * `process.env.IDX_PROVIDER` or a per-agent setting.
 */
export function getIdxAdapter(): IdxAdapter {
  const provider = process.env.IDX_PROVIDER?.trim().toLowerCase() || "rentcast";
  switch (provider) {
    case "rentcast":
      return rentcastIdxAdapter;
    // case "idx_broker": return idxBrokerAdapter;
    // case "mls_grid":  return mlsGridAdapter;
    default:
      return rentcastIdxAdapter;
  }
}

/**
 * Standard MLS-attribution string for footer / disclaimer rendering. Never
 * inline this — go through here so the wording stays consistent across SRP,
 * PDP, search cards, and lead-capture confirmation pages.
 */
export function buildMlsAttribution(opts: { mlsName: string | null; listingBrokerName?: string | null }): string {
  const parts: string[] = [];
  if (opts.listingBrokerName) parts.push(`Listing courtesy of ${opts.listingBrokerName}`);
  if (opts.mlsName) parts.push(`Source: ${opts.mlsName}`);
  if (parts.length === 0) return "Listing data provided by third-party MLS sources.";
  return parts.join(" · ");
}
