import { cn } from "@/lib/utils";

export type KpiCardProps = {
  label: string;
  value: string;
  subtext?: string;
  className?: string;
};

/** Joins legacy `hint` + `delta` fields into one line for `subtext`. */
export function kpiSubtext(args: { hint?: string; delta?: { value: string } }): string | undefined {
  const parts = [args.hint, args.delta?.value].filter(Boolean) as string[];
  return parts.length ? parts.join(" · ") : undefined;
}

export function KpiCard({ label, value, subtext, className }: KpiCardProps) {
  return (
    <div className={cn("rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm", className)}>
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">{value}</div>
      {subtext ? <div className="mt-1 text-xs text-gray-400">{subtext}</div> : null}
    </div>
  );
}
