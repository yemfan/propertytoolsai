"use client";

import { useState, useTransition } from "react";
import { BellRing, Loader2, Save } from "lucide-react";
import { saveReminderSettings } from "@/lib/actions/outbound";

type Reminder = { key: string; name: string; phone: string | null; startAt: string; reminderAt: string; status: string };

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Scheduled", cls: "bg-slate-100 text-slate-600" },
  queued: { label: "Dialing soon", cls: "bg-amber-50 text-amber-700" },
  calling: { label: "Calling…", cls: "bg-amber-50 text-amber-700" },
  done: { label: "Called", cls: "bg-emerald-50 text-emerald-700" },
  failed: { label: "Failed", cls: "bg-red-50 text-red-700" },
};

export function AppointmentReminders({
  enabled,
  leadMinutes,
  reminders,
  hasNumber,
}: {
  enabled: boolean;
  leadMinutes: number;
  reminders: Reminder[];
  hasNumber: boolean;
}) {
  const initUnit: "hours" | "days" = leadMinutes % 1440 === 0 ? "days" : "hours";
  const initValue = initUnit === "days" ? leadMinutes / 1440 : Math.round(leadMinutes / 60);
  const [isOn, setIsOn] = useState(enabled);
  const [value, setValue] = useState(initValue || 1);
  const [unit, setUnit] = useState<"hours" | "days">(initUnit);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function save() {
    const mins = unit === "days" ? value * 1440 : value * 60;
    start(async () => {
      await saveReminderSettings({ enabled: isOn, leadMinutes: mins });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
        <BellRing className="w-4 h-4 text-indigo-500" />
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-slate-700">Automatic appointment reminders</h2>
          <p className="text-xs text-slate-400">The agent auto-calls to confirm upcoming appointments.</p>
        </div>
        <button
          onClick={() => setIsOn((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isOn ? "bg-indigo-600" : "bg-slate-200"}`}
        >
          <span className={`inline-block w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${isOn ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>

      <div className="p-6 space-y-4">
        {/* Lead-time setting */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span>Call</span>
          <input
            type="number"
            min={1}
            value={value}
            onChange={(e) => setValue(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as "hours" | "days")}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="hours">hours</option>
            <option value="days">days</option>
          </select>
          <span>before the appointment.</span>
          <button
            onClick={save}
            disabled={pending}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? "Saved!" : "Save"}
          </button>
        </div>

        {!hasNumber && (
          <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-700">
            Connect a phone number in{" "}
            <a href="/settings#voice-agent" className="underline">Settings → AI Voice agent</a> to place reminder calls.
          </div>
        )}

        {/* Scheduled reminders */}
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">Upcoming reminders</p>
          {reminders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
              No upcoming appointments with a phone number.
            </div>
          ) : (
            <div className="divide-y divide-slate-50 border border-slate-100 rounded-lg overflow-hidden">
              {reminders.map((r) => {
                const s = STATUS[r.status] ?? STATUS.pending;
                return (
                  <div key={r.key} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{r.name || "Unnamed"}</p>
                      <p className="text-xs text-slate-400 truncate">
                        Appt {fmt(r.startAt)} · reminder {fmt(r.reminderAt)}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${s.cls}`}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          )}
          {!isOn && (
            <p className="text-[11px] text-slate-400 mt-2">
              Reminders are off — turn on the toggle above and Save to start auto-calling.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
