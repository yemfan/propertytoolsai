import { cn } from "@/lib/utils";

export type PriorityLevel = "low" | "medium" | "high" | "urgent";

const map: Record<PriorityLevel, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-slate-100 text-slate-700 ring-slate-200/80" },
  medium: { label: "Medium", className: "bg-sky-50 text-sky-800 ring-sky-100" },
  high: { label: "High", className: "bg-amber-50 text-amber-900 ring-amber-100" },
  urgent: { label: "Urgent", className: "bg-rose-50 text-rose-800 ring-rose-100" },
};

export function PriorityBadge({
  level,
  className,
}: {
  level: PriorityLevel;
  className?: string;
}) {
  const { label, className: cnBase } = map[level];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1",
        cnBase,
        className
      )}
    >
      {label}
    </span>
  );
}
