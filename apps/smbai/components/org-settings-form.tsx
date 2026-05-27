"use client";

import { useActionState } from "react";
import { updateOrg } from "@/lib/actions/settings";
import type { SettingsState } from "@/lib/actions/settings";

interface Props {
  org: {
    name: string;
    entity_type: string;
    timezone: string;
    fiscal_year_end_month: number;
  } | null;
  timezones: string[];
  months: string[];
  defaultHourlyRate?: number | null;
}

export function OrgSettingsForm({ org, timezones, months, defaultHourlyRate }: Props) {
  const [state, action, isPending] = useActionState<SettingsState, FormData>(
    updateOrg,
    null
  );

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Business name</label>
        <input
          name="name"
          type="text"
          required
          disabled={isPending}
          defaultValue={org?.name ?? ""}
          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Timezone</label>
          <select
            name="timezone"
            defaultValue={org?.timezone ?? "America/New_York"}
            disabled={isPending}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>{tz.replace("America/", "").replace("Pacific/", "Pacific/").replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Fiscal year end</label>
          <select
            name="fiscal_year_end_month"
            defaultValue={org?.fiscal_year_end_month ?? 12}
            disabled={isPending}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
          >
            {months.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Entity type</label>
          <input
            type="text"
            disabled
            value={org?.entity_type?.replace("_", " ").toUpperCase() ?? "—"}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-slate-500 cursor-not-allowed"
          />
          <p className="text-[10px] text-slate-400 mt-1">Contact support to change entity type.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Default hourly rate</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input
              name="default_hourly_rate"
              type="number"
              min="0"
              step="0.01"
              disabled={isPending}
              defaultValue={defaultHourlyRate ?? ""}
              placeholder="e.g. 125"
              className="w-full text-sm border border-slate-300 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Applied automatically when starting a timer.</p>
        </div>
      </div>

      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">Settings saved.</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
