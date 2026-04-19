import type { TemplateChannel, TemplateStatus } from "./types";

/**
 * Pure template helpers — zero runtime deps. Safe to import from
 * `"use client"` components. The full `lib/templates/service.ts`
 * pulls in `supabaseAdmin` (a server-only service-role client) at
 * module-load, so importing any helper from there into the client
 * bundle crashes hydration with "supabaseKey is required" — same bug
 * as the sphere formatters extraction last month.
 *
 * service.ts re-exports these for server-side callers so the public
 * API surface doesn't change.
 */

export function smsLengthForBody(body: string): number {
  // SMS is measured by codepoints; reasonably close for previews. GSM-7 vs UCS-2
  // transitions (emoji, accented chars) are ignored — good enough for a counter.
  return Array.from(body).length;
}

export function channelPreviewMaxChars(channel: TemplateChannel): number | null {
  return channel === "sms" ? 160 : null;
}

export function validateStatus(v: unknown): TemplateStatus | undefined {
  return v === "autosend" || v === "review" || v === "off" ? v : undefined;
}
