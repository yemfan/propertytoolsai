import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "neutral" | "info" | "danger";

const tones: Record<StatusTone, string> = {
  success: "bg-emerald-50 text-emerald-800 ring-emerald-100",
  warning: "bg-amber-50 text-amber-900 ring-amber-100",
  neutral: "bg-slate-100 text-slate-700 ring-slate-200/80",
  info: "bg-sky-50 text-sky-800 ring-sky-100",
  danger: "bg-rose-50 text-rose-800 ring-rose-100",
};

export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
