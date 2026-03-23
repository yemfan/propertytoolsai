"use client";

import Link from "next/link";
import type { LimitReason } from "@/lib/entitlements/types";

type Props = {
  open: boolean;
  onClose: () => void;
  reason: LimitReason | null;
  plan: string | null;
};

function getMessage(reason: LimitReason | null) {
  switch (reason) {
    case "lead_limit_reached":
      return {
        title: "You’ve reached your lead limit",
        body: "Upgrade to Growth to manage up to 500 leads and keep your pipeline moving.",
      };
    case "cma_limit_reached":
      return {
        title: "You’ve used all CMA reports for today",
        body: "Upgrade to unlock more daily CMA reports and support more client activity.",
      };
    case "contact_limit_reached":
      return {
        title: "Your CRM contact limit has been reached",
        body: "Upgrade to Growth or Elite to continue adding contacts and scaling your business.",
      };
    case "download_limit_reached":
      return {
        title: "This download is not included in your plan",
        body: "Upgrade to unlock full report downloads and advanced exports.",
      };
    case "team_access_not_enabled":
      return {
        title: "Team access is not enabled on your plan",
        body: "Upgrade to Elite to invite teammates and collaborate inside your workspace.",
      };
    case "no_agent_entitlement":
    default:
      return {
        title: "Activate Agent Access",
        body: "Start free as an agent to unlock your workspace, lead tools, CRM, and AI actions.",
      };
  }
}

export default function EntitlementUpgradeModal({ open, onClose, reason, plan }: Props) {
  if (!open) return null;

  const message = getMessage(reason);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900">{message.title}</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">{message.body}</p>
            {plan ? (
              <div className="mt-3 text-xs text-gray-400">
                Current plan: <span className="font-medium text-gray-700">{plan}</span>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/pricing"
            className="rounded-2xl bg-gray-900 px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-gray-800"
            onClick={onClose}
          >
            Upgrade Now
          </Link>
          <Link
            href="/start-free/agent"
            className="rounded-2xl border px-5 py-3 text-center text-sm font-medium text-gray-900 transition hover:bg-gray-50"
            onClick={onClose}
          >
            View Agent Plans
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Short labels for UI — map to `LimitReason` when opening the modal */
export type UpgradeLimitKind = "lead" | "cma" | "contact" | "report" | "team";

export function upgradeKindToLimitReason(kind: UpgradeLimitKind): LimitReason {
  switch (kind) {
    case "lead":
      return "lead_limit_reached";
    case "cma":
      return "cma_limit_reached";
    case "contact":
      return "contact_limit_reached";
    case "report":
      return "download_limit_reached";
    case "team":
      return "team_access_not_enabled";
    default:
      return "no_agent_entitlement";
  }
}
