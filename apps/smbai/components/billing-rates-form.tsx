"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { saveBillingRates } from "@/lib/actions/settings";

function toNum(v: string): number | null {
  const t = v.trim();
  return t && !isNaN(parseFloat(t)) ? parseFloat(t) : null;
}

export function BillingRatesForm({
  hourlyRate,
  laborCostRate,
}: {
  hourlyRate: number | null;
  laborCostRate: number | null;
}) {
  const [hr, setHr] = useState(hourlyRate?.toString() ?? "");
  const [lc, setLc] = useState(laborCostRate?.toString() ?? "");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      await saveBillingRates({ hourlyRate: toNum(hr), laborCostRate: toNum(lc) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Default hourly rate</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={hr}
              onChange={(e) => setHr(e.target.value)}
              disabled={pending}
              placeholder="e.g. 125"
              className="w-full text-sm border border-slate-300 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Your billable rate — applied automatically when starting a timer.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Default labor cost rate</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={lc}
              onChange={(e) => setLc(e.target.value)}
              disabled={pending}
              placeholder="e.g. 45"
              className="w-full text-sm border border-slate-300 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">What an hour of work costs you (wages/contractor pay). Used for project profit.</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={pending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          <Save className="w-4 h-4" />
          {pending ? "Saving…" : saved ? "Saved!" : "Save rates"}
        </button>
      </div>
    </div>
  );
}
