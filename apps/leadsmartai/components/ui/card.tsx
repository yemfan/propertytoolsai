import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Card — default elevation is `shadow-raised` (brand-tinted, from the
 * `@theme` block in globals.css). Pass `interactive` for the hover
 * lift used on clickable cards (Plan cards, feature tiles, blog
 * teasers).
 */
export function Card({
  className,
  interactive = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/90 bg-white text-slate-950 shadow-raised ring-1 ring-slate-900/[0.04] dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-50 dark:shadow-none dark:ring-slate-700/40",
        interactive &&
          "transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-floating",
        className
      )}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6", className)} {...props} />;
}
