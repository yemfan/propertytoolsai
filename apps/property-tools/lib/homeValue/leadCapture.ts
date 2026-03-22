/**
 * When to show lead capture for the Home Value funnel.
 *
 * Rules:
 * - Never gate before the user has a preview estimate (instant value + range).
 * - Strong gate: full report / detailed comps / export — unlock flow (modal).
 * - Soft prompts: after a first *useful* estimate, or after the user refines details.
 */

import type { HomeValueEstimateResponse } from "@/lib/homeValue/types";

export type LeadCaptureGate =
  | "none"
  /** No estimate yet — do not show modal or blocking prompts. */
  | "before_preview"
  /** User has preview; soft CTA allowed; unlock CTA = primary gate for full report. */
  | "preview_only"
  /** Ready for soft “save / unlock” prompts (useful estimate or refined). */
  | "eligible_soft_prompt";

/**
 * User has any preview estimate (point value returned).
 */
export function hasPreviewEstimate(result: HomeValueEstimateResponse | null | undefined): boolean {
  const p = result?.estimate?.point;
  return p != null && Number.isFinite(p) && p > 0;
}

/**
 * “Useful” = non-zero estimate plus enough signal to be actionable
 * (not low confidence with zero comps, unless user still has a number).
 */
export function isUsefulEstimate(result: HomeValueEstimateResponse | null | undefined): boolean {
  if (!hasPreviewEstimate(result) || !result) return false;
  const priced = result.comps?.pricedCount ?? 0;
  const level = result.confidence?.level;
  if (level === "low" && priced === 0) return false;
  return true;
}

export function buildRefineSnapshot(input: {
  beds: string;
  baths: string;
  sqft: string;
  lotSqft: string;
  yearBuilt: string;
  propertyType: string;
  condition: string;
  renovation: string;
}): string {
  return [
    input.beds.trim(),
    input.baths.trim(),
    input.sqft.trim(),
    input.lotSqft.trim(),
    input.yearBuilt.trim(),
    input.propertyType.trim(),
    input.condition,
    input.renovation,
  ].join("|");
}

export function hasRefinedSinceBaseline(
  baseline: string | null,
  current: string
): boolean {
  if (!baseline) return false;
  return baseline !== current;
}

/**
 * Whether we should show a non-blocking “unlock / email” banner (after preview, before unlock).
 */
export function shouldShowSoftLeadPrompt(input: {
  reportUnlocked: boolean;
  hasPreview: boolean;
  useful: boolean;
  refined: boolean;
  bannerDismissed: boolean;
}): boolean {
  if (input.reportUnlocked || input.bannerDismissed) return false;
  if (!input.hasPreview) return false;
  return input.useful || input.refined;
}

/**
 * Unlock / full report gate — only after preview exists.
 */
export function canOpenFullReportGate(result: HomeValueEstimateResponse | null | undefined): boolean {
  return hasPreviewEstimate(result);
}

export function resolveLeadCaptureGate(
  result: HomeValueEstimateResponse | null | undefined,
  opts: { reportUnlocked: boolean; refined: boolean }
): LeadCaptureGate {
  if (!hasPreviewEstimate(result)) return "before_preview";
  if (opts.reportUnlocked) return "none";
  if (isUsefulEstimate(result) || opts.refined) return "eligible_soft_prompt";
  return "preview_only";
}
