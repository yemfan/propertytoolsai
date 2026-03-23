"use client";

import { useState } from "react";
import UpgradeModal from "@/components/billing/UpgradeModal";

export default function ExamplePage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto max-w-lg p-8">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-gray-900 px-4 py-3 text-white"
      >
        Trigger Upgrade Modal
      </button>

      <UpgradeModal
        open={open}
        onClose={() => setOpen(false)}
        reason="lead_limit_reached"
        plan="starter"
      />
    </div>
  );
}
