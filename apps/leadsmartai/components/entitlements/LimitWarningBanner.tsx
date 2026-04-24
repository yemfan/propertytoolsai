"use client";

import Link from "next/link";
import { useLimitStatus } from "@/lib/entitlements/useLimitStatus";
import type { AgentLimitApiAction } from "@/lib/entitlements/checkAgentLimitClient";

/**
 * Shows a warning banner when the agent's usage of a specific metric
 * is at or above 80% of their plan cap. Silent otherwise (returns null).
 *
 * The banner does NOT block action — it's a heads-up. The underlying
 * API route will still 403 the request if the user actually tries to
 * exceed the cap, and the EntitlementUpgradeModal will pop at that
 * moment.
 *
 * Drop this into any page whose main flow consumes a limited metric
 * (e.g. contacts list, transaction detail for AI review).
 */

const LABEL_BY_ACTION: Record<AgentLimitApiAction, { thing: string; plural: string; unit: string }> = {
  create_cma: { thing: "CMA report", plural: "CMA reports", unit: "today" },
  add_lead: { thing: "lead", plural: "leads", unit: "total" },
  add_contact: { thing: "contact", plural: "contacts", unit: "total" },
  download_full_report: { thing: "download", plural: "downloads", unit: "today" },
  invite_team: { thing: "team invite", plural: "team invites", unit: "" },
  ai_action: { thing: "AI token", plural: "AI tokens", unit: "this month" },
};

export function LimitWarningBanner({ action }: { action: AgentLimitApiAction }) {
  const status = useLimitStatus(action);

  if (status.state !== "near" && status.state !== "hit") return null;

  const { thing, plural, unit } = LABEL_BY_ACTION[action];
  const { current, limit, state } = status;

  // Copy adapts based on whether they're near or at the cap.
  const isHit = state === "hit";
  const tone = isHit
    ? "border-red-200 bg-red-50 text-red-900"
    : "border-amber-200 bg-amber-50 text-amber-900";
  const icon = isHit ? "🚫" : "⚠️";
  const headline = isHit
    ? `You've used all your ${plural} ${unit}.`
    : `You're close to your ${thing} cap ${unit}.`;
  const detail =
    current != null && limit != null
      ? `${current} of ${limit} used${isHit ? "." : ""}`
      : null;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm ${tone}`}
    >
      <div className="flex items-start gap-2">
        <span aria-hidden className="text-lg leading-none">
          {icon}
        </span>
        <div>
          <div className="font-semibold">{headline}</div>
          {detail ? <div className="mt-0.5 text-xs opacity-80">{detail}</div> : null}
        </div>
      </div>
      <Link
        href="/dashboard/billing"
        className="inline-flex items-center rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
      >
        {isHit ? "Upgrade now" : "See plan options"}
      </Link>
    </div>
  );
}
