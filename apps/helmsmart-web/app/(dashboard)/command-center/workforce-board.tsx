import type { WorkforceSummary } from "@helm/dna-intelligence";
import { SeedWorkforceButton } from "./seed-workforce-button";
import { EmployeeAvatarPicker } from "./employee-avatar-picker";

/** "calls_answered" → "Calls Answered". */
function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function WorkforceBoard({
  summary,
  avatarById,
}: {
  summary: WorkforceSummary;
  /** employeeId → resolved avatar id (chosen, or a stable default). */
  avatarById: Record<string, string>;
}) {
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
        {summary.employees.map((e) => {
          const keys = Object.keys(e.metrics);
          return (
            <div key={e.employeeId} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <EmployeeAvatarPicker
                  employeeId={e.employeeId}
                  name={e.name}
                  value={avatarById[e.employeeId] ?? "persona-01"}
                />
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
