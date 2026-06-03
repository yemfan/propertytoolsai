import type { WorkforceSummary } from "@helm/dna-intelligence";
import { SeedWorkforceButton } from "./seed-workforce-button";

/** "calls_answered" → "Calls Answered". */
function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const AVATAR_COLORS = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-sky-500",
  "bg-rose-500",
  "bg-violet-500",
];

export function WorkforceBoard({ summary }: { summary: WorkforceSummary }) {
  if (summary.employees.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <h2 className="text-lg font-semibold text-slate-900">No AI employees yet</h2>
        <p className="text-sm text-slate-500 mt-1 mb-6 max-w-md mx-auto">
          Hire your six-person AI back office — a receptionist, an SDR, and four
          department directors — in one click. They start in draft so you can review
          each before switching them on.
        </p>
        <SeedWorkforceButton />
      </div>
    );
  }

  const totalKeys = Object.keys(summary.totals);

  return (
    <div className="space-y-6">
      {/* Org-wide totals */}
      {totalKeys.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {totalKeys.map((k) => (
            <div key={k} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-2xl font-semibold text-slate-900">{summary.totals[k]}</p>
              <p className="text-xs text-slate-500 mt-0.5">{humanize(k)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Roster */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {summary.employees.map((e, i) => {
          const keys = Object.keys(e.metrics);
          return (
            <div key={e.employeeId} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white font-semibold`}
                >
                  {e.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{e.name}</p>
                  <p className="text-xs text-slate-500">{e.role}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
                {keys.length === 0 ? (
                  <p className="text-sm text-slate-400">No activity yet</p>
                ) : (
                  keys.map((k) => (
                    <div key={k}>
                      <p className="text-lg font-semibold text-slate-900">{e.metrics[k]}</p>
                      <p className="text-[11px] text-slate-500">{humanize(k)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
