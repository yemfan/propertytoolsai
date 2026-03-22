/**
 * Browser session helpers for intent signals (cross-tool + revisit).
 * Use only from client components.
 */

import type { IntentSignals } from "@/lib/homeValue/types";
import { looksLikeListingAddress } from "@/lib/homeValue/intentSignals";

export const HV_INTENT_STORAGE = {
  lastAddress: "propertytoolsai:hv_intent:last_address",
  mortgageFromHv: "propertytoolsai:hv_cross:mortgage",
  comparisonFromHv: "propertytoolsai:hv_cross:comparison",
  rentRoiFromHv: "propertytoolsai:hv_cross:rent_roi_cap",
} as const;

function readAndClearFlag(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(key) !== "1") return false;
    sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function markCrossToolNavigationFromHomeValue(
  tool: "mortgage" | "comparison" | "rent_roi_cap"
): void {
  if (typeof window === "undefined") return;
  const key =
    tool === "mortgage"
      ? HV_INTENT_STORAGE.mortgageFromHv
      : tool === "comparison"
        ? HV_INTENT_STORAGE.comparisonFromHv
        : HV_INTENT_STORAGE.rentRoiFromHv;
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Build intent_signals for POST /api/home-value-estimate.
 */
export function buildClientIntentSignals(opts: {
  address: string;
  reportUnlocked: boolean;
  clickedCma: boolean;
  clickedExpert: boolean;
}): Partial<IntentSignals> {
  const addr = opts.address.trim().toLowerCase();
  let revisitSameAddress = false;
  if (typeof window !== "undefined" && addr) {
    try {
      const prev = sessionStorage.getItem(HV_INTENT_STORAGE.lastAddress) ?? "";
      if (prev && prev === addr) revisitSameAddress = true;
      sessionStorage.setItem(HV_INTENT_STORAGE.lastAddress, addr);
    } catch {
      /* ignore */
    }
  }

  return {
    homeValueUsed: true,
    fullReportUnlocked: opts.reportUnlocked,
    askedForCma: opts.clickedCma,
    expertHelpClicked: opts.clickedExpert,
    revisitSameAddress,
    listingLikeAddress: looksLikeListingAddress(opts.address),
    mortgageAfterEstimate: readAndClearFlag(HV_INTENT_STORAGE.mortgageFromHv),
    comparisonToolUsed: readAndClearFlag(HV_INTENT_STORAGE.comparisonFromHv),
    rentOrRoiOrCapToolUsed: readAndClearFlag(HV_INTENT_STORAGE.rentRoiFromHv),
  };
}
