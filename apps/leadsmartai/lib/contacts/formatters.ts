/**
 * Pure display formatters for contacts. Zero runtime deps — safe to
 * import from `"use client"` components. Server-side callers can import
 * from here too; the old re-exports from `lib/sphere/service` stay as
 * shims until Cluster B migrates the callers.
 */

import type { LifecycleStage, RelationshipType } from "./types";

// =============================================================================
// Avatar
// =============================================================================

const AVATAR_PALETTE = [
  "#0072ce", // LeadSmart blue
  "#8F4A2E",
  "#5C4A3E",
  "#6B5D4E",
  "#7A5B42",
  "#4A3E33",
  "#6B4A3E",
  "#2E6B7A",
  "#5B7A4A",
];

/**
 * Stable color derived from a seed (usually contact id). Same seed always
 * produces the same color.
 */
export function avatarColorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

// =============================================================================
// Name helpers
// =============================================================================

export function initialsFor(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  const a = first.charAt(0).toUpperCase();
  const b = last.charAt(0).toUpperCase();
  if (a && b) return `${a}${b}`;
  if (a) return first.slice(0, 2).toUpperCase();
  if (b) return last.slice(0, 2).toUpperCase();
  return "??";
}

export function fullNameFor(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallback?: string | null,
): string {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  const full = [first, last].filter(Boolean).join(" ");
  if (full) return full;
  return (fallback ?? "").trim() || "(no name)";
}

/**
 * Split a single-field name ("John Smith") into first + last. First token
 * becomes first_name; everything after the first whitespace becomes
 * last_name. Used during leads→contacts backfill and CSV import.
 */
export function splitName(
  name: string | null | undefined,
): { firstName: string | null; lastName: string | null } {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return { firstName: null, lastName: null };
  const idx = trimmed.search(/\s/);
  if (idx < 0) return { firstName: trimmed, lastName: null };
  return {
    firstName: trimmed.slice(0, idx),
    lastName: trimmed.slice(idx + 1).trim() || null,
  };
}

// =============================================================================
// Currency / percent
// =============================================================================

export function currencyFormat(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toFixed(0)}`;
}

export function percentFormat(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${Math.round(n * 100)}%`;
}

// =============================================================================
// Label helpers
// =============================================================================

export function lifecycleLabel(stage: LifecycleStage): string {
  switch (stage) {
    case "lead":
      return "Lead";
    case "active_client":
      return "Active client";
    case "past_client":
      return "Past client";
    case "sphere":
      return "Sphere";
    case "referral_source":
      return "Referrer";
    case "archived":
      return "Archived";
  }
}

export function relationshipLabel(t: RelationshipType | null): string {
  if (!t) return "—";
  switch (t) {
    case "past_buyer":
      return "Past buyer · client";
    case "past_seller":
      return "Past seller · client";
    case "past_both":
      return "Past buyer + seller";
    case "sphere":
      return "Sphere";
    case "referral_source":
      return "Referrer";
    case "prospect":
      return "Prospect";
  }
}

/**
 * Back-compat shim. The sphere schema used longer enum values like
 * `past_buyer_client`. CSV imports and legacy UI code may still pass
 * those — normalize to the new compact form.
 */
export function normalizeRelationshipType(
  raw: string | null | undefined,
): RelationshipType | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  switch (v) {
    case "past_buyer_client":
    case "past_buyer":
      return "past_buyer";
    case "past_seller_client":
    case "past_seller":
      return "past_seller";
    case "past_both":
    case "past_buyer_seller":
      return "past_both";
    case "sphere_non_client":
    case "sphere":
      return "sphere";
    case "referral_source":
    case "referrer":
      return "referral_source";
    case "prospect":
      return "prospect";
    default:
      return null;
  }
}

// =============================================================================
// Date helpers
// =============================================================================

export function daysBetween(
  laterIso: string | Date,
  earlierIso: string | Date,
): number {
  const later = laterIso instanceof Date ? laterIso : new Date(laterIso);
  const earlier = earlierIso instanceof Date ? earlierIso : new Date(earlierIso);
  const ms = later.getTime() - earlier.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/**
 * Signed days until the anniversary of `closingIso` relative to `today`.
 * Positive = upcoming, negative = recently passed. Caller takes abs().
 */
export function daysToAnniversary(closingIso: string, today: Date): number {
  const d = new Date(closingIso);
  const anniversary = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  return Math.round(
    (anniversary.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}
