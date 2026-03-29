"use client";

import type { LimitReason } from "@/lib/entitlements/types";

export const FUNNEL_UPGRADE_EVENT = "leadsmart-funnel-upgrade";

/** Dispatch from client code when an API returns 402 with `limitReason` so the workspace upgrade modal opens. */
export function emitLeadsmartUpgradePrompt(limitReason: LimitReason): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(FUNNEL_UPGRADE_EVENT, { detail: { limitReason } })
  );
}
