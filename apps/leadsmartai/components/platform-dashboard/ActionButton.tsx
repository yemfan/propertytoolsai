import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ActionVariant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<ActionVariant, string> = {
  primary:
    "bg-emerald-600 text-white shadow-sm shadow-emerald-900/25 hover:bg-emerald-700 focus-visible:ring-emerald-500/40",
  secondary:
    "border border-slate-200/90 bg-white text-slate-800 shadow-sm hover:bg-slate-50 focus-visible:ring-slate-400/30",
  ghost: "text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-400/30",
  danger:
    "bg-rose-600 text-white shadow-sm shadow-rose-900/20 hover:bg-rose-700 focus-visible:ring-rose-500/40",
};

export function ActionButton({
  variant = "secondary",
  children,
  className,
  leftIcon,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ActionVariant;
  leftIcon?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold outline-none transition focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className
      )}
      {...props}
    >
      {leftIcon}
      {children}
    </button>
  );
}
