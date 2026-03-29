import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: string;
  subtext?: string;
  trend?: ReactNode;
  className?: string;
};

export function KpiCard({ label, value, subtext, trend, className }: KpiCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-gray-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-gray-900/[0.03]",
        className
      )}
    >
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <div className="text-2xl font-semibold tracking-tight text-gray-900">{value}</div>
        {trend ? <div className="shrink-0 text-xs font-medium text-emerald-600">{trend}</div> : null}
      </div>
      {subtext ? <div className="mt-1 text-xs text-gray-400">{subtext}</div> : null}
    </div>
  );
}
