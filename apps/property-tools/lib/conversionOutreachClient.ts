"use client";

import { readBehaviorEvents } from "@/lib/behaviorStore";
import { buildUserProfile } from "@/lib/userProfile";

/**
 * Call after high-value tool usage (AI comparison, CMA, multi-tool sessions).
 * Server applies `predictLeadScore` + `checkTriggers` and may send SMS/email when
 * `OUTREACH_AUTO_ENABLED=true` and score > 70.
 */
export async function evaluateConversionOutreach(options?: {
  leadId?: string;
  contact?: { name?: string; email?: string; phone?: string };
  /** Force prediction-only (no sends) */
  dryRun?: boolean;
}): Promise<unknown> {
  const profile = buildUserProfile(readBehaviorEvents());
  try {
    const res = await fetch("/api/outreach/evaluate", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile,
        leadId: options?.leadId,
        contact: options?.contact,
        dryRun: options?.dryRun,
      }),
    });
    return await res.json().catch(() => ({}));
  } catch {
    return { ok: false };
  }
}
