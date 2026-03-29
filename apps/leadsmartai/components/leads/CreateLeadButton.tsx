"use client";

import { useState } from "react";
import UpgradeModal from "@/components/billing/UpgradeModal";
import { checkAgentLimit, consumeAgentUsage } from "@/lib/entitlements/clientCheck";
import type { LimitReason } from "@/lib/entitlements/types";

export default function CreateLeadButton() {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [reason, setReason] = useState<LimitReason | null>(null);
  const [plan, setPlan] = useState<string | null>(null);

  async function handleClick() {
    const result = await checkAgentLimit({ action: "add_lead" });

    if (!result.allowed) {
      setReason(result.reason);
      setPlan(result.plan);
      setUpgradeOpen(true);
      return;
    }

    try {
      // Create lead (your API / mutation) …
      await consumeAgentUsage({ action: "add_lead" });
    } catch (e) {
      console.error(e);
      setReason("lead_limit_reached");
      setPlan(result.plan);
      setUpgradeOpen(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        className="rounded-xl bg-gray-900 px-4 py-3 text-white"
      >
        Add Lead
      </button>

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        reason={reason}
        plan={plan}
      />
    </>
  );
}
