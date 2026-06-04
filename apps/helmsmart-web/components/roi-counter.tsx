import { TrendingUp, PhoneMissed, CalendarCheck } from "lucide-react";

type Props = {
  /** Missed calls that were auto-texted in the last 7 days. */
  autoTexted: number;
  /** SMS conversations that resulted in a booking in the last 7 days (from ai_employee_runs). */
  bookedViaSms: number;
};

/**
 * Shows the missed-call → SMS → booked conversion funnel for the last 7 days.
 * The "booked via SMS" number comes from real ai_employee_runs.outcome.booked
 * set by Emma's tool-use loop (Phase 3), so it reflects actual bookings, not estimates.
 */
export function RoiCounter({ autoTexted, bookedViaSms }: Props) {
  const pct = autoTexted > 0 ? Math.round((bookedViaSms / autoTexted) * 100) : 0;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-emerald-500" />
        <h2 className="text-sm font-semibold text-slate-700">Missed-call recovery — last 7 days</h2>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Auto-texted</span>
            <PhoneMissed className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-semibold text-slate-800 font-mono">{autoTexted}</p>
          <p className="text-xs text-slate-400 mt-0.5">Missed calls texted back</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Booked via SMS</span>
            <CalendarCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-semibold text-slate-800 font-mono">{bookedViaSms}</p>
          <p className="text-xs text-slate-400 mt-0.5">Appointments recovered</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Conversion</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-semibold text-slate-800 font-mono">
            {autoTexted === 0 ? "—" : `${pct}%`}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {autoTexted === 0 ? "No missed calls yet" : `${bookedViaSms} of ${autoTexted} leads booked`}
          </p>
        </div>
      </div>
    </section>
  );
}
