"use client";

import { useState, useTransition } from "react";
import { Sparkles, Check } from "lucide-react";
import { letAlexRemind } from "@/lib/actions/approvals";

export function AlexReminderBanner({ overdueCount, overdueTotal }: { overdueCount: number; overdueTotal: string }) {
  const [status, setStatus] = useState<"idle" | "queued" | "no_overdue" | "error">("idle");
  const [, startTransition] = useTransition();

  if (overdueCount === 0 || status === "no_overdue") return null;

  function ask() {
    startTransition(async () => {
      const res = await letAlexRemind();
      setStatus(res.status === "queued" ? "queued" : res.status === "no_overdue" ? "no_overdue" : "error");
    });
  }

  if (status === "queued") {
    return (
      <div className="flex items-center gap-3 mb-6 px-5 py-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm">
        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span className="text-emerald-800 font-medium">Queued for your approval —</span>
        <a href="/approvals" className="text-emerald-700 underline font-medium">review it</a>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 mb-6 px-5 py-3.5 bg-rose-50 border border-rose-200 rounded-xl">
      <p className="text-sm text-rose-800">
        <span className="font-semibold">{overdueCount} overdue invoice{overdueCount > 1 ? "s" : ""}</span>
        {" "}totaling{" "}
        <span className="font-semibold">{overdueTotal}</span>
        {" "}with no reminders sent yet.
      </p>
      <button
        onClick={ask}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg hover:bg-rose-50 transition-colors shrink-0"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Ask Alex to remind them
      </button>
      {status === "error" && <p className="text-xs text-rose-500">Something went wrong.</p>}
    </div>
  );
}
