"use client";

const STEPS = [
  { id: 1, label: "Address" },
  { id: 2, label: "Details" },
  { id: 3, label: "Analyze" },
  { id: 4, label: "Preview" },
  { id: 5, label: "Contact" },
  { id: 6, label: "Results" },
] as const;

type Props = {
  current: number;
};

export default function ProgressBar({ current }: Props) {
  return (
    <div className="w-full" aria-label="Funnel progress">
      <ol className="flex items-center justify-between gap-0.5 sm:gap-1">
        {STEPS.map((s) => {
          const done = current > s.id;
          const active = current === s.id;
          return (
            <li key={s.id} className="flex min-w-0 flex-1 flex-col items-center">
              <div
                className={[
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors sm:h-9 sm:w-9 sm:text-sm",
                  done
                    ? "bg-[#0072ce] text-white"
                    : active
                      ? "bg-gray-900 text-white ring-2 ring-[#0072ce]/40"
                      : "bg-gray-100 text-gray-500",
                ].join(" ")}
                aria-current={active ? "step" : undefined}
              >
                {done ? "✓" : s.id}
              </div>
              <span
                className={[
                  "mt-1 hidden max-w-[4.5rem] truncate text-center text-[10px] font-medium sm:block sm:max-w-none sm:text-xs",
                  active ? "text-gray-900" : "text-gray-500",
                ].join(" ")}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-2 text-center text-xs text-gray-500 sm:hidden">
        Step {current} of {STEPS.length}
      </div>
    </div>
  );
}
