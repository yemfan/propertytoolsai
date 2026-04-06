import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/90 bg-white text-slate-950 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.04] dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-50 dark:shadow-none dark:ring-slate-700/40",
        className
      )}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6", className)} {...props} />;
}
