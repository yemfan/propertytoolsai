import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * Modern card surfaces with depth, glassmorphism, and dark mode support.
 * Matches premium SaaS design: soft ring + shadow, hover lift, brand tints.
 */
export const cardVariants = {
  default:
    "rounded-xl border border-slate-200/90 bg-white text-slate-950 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.04] dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-50 dark:shadow-none dark:ring-slate-700/40",
  /** Links / clickable tiles — hover lift + brand-tint border */
  interactive:
    "rounded-xl border border-slate-200/90 bg-white text-slate-950 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.04] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg hover:shadow-[#0072ce]/[0.08] hover:border-[#0072ce]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0072ce]/40 dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-50 dark:ring-slate-700/40 dark:hover:border-[#4da3e8]/40 dark:hover:shadow-[#0072ce]/[0.15]",
  muted:
    "rounded-xl border border-slate-200/70 bg-slate-50/90 text-slate-950 shadow-sm dark:border-slate-700/50 dark:bg-slate-800/60 dark:text-slate-100",
  flat: "rounded-xl border border-slate-200/80 bg-white text-slate-950 dark:border-slate-700/50 dark:bg-slate-900 dark:text-slate-50",
  /** Nested blocks inside a card (briefing panels, etc.) */
  inset: "rounded-lg border border-slate-100 bg-slate-50/60 dark:border-slate-700/40 dark:bg-slate-800/40",
  /** Frosted glass effect — use on hero sections, overlays, featured content */
  glass:
    "rounded-xl border border-white/20 bg-white/60 text-slate-950 shadow-lg shadow-slate-900/[0.06] ring-1 ring-white/30 backdrop-blur-xl dark:border-slate-600/30 dark:bg-slate-900/60 dark:text-slate-50 dark:ring-slate-500/20",
  /** Gradient accent — subtle directional gradient for premium feel */
  gradient:
    "rounded-xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-[#0072ce]/[0.04] text-slate-950 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.04] transition-all duration-300 hover:to-[#0072ce]/[0.08] hover:shadow-md dark:border-slate-700/60 dark:from-slate-900 dark:via-slate-900 dark:to-[#0072ce]/[0.08] dark:text-slate-50 dark:ring-slate-700/40",
} as const;

export type CardVariant = keyof typeof cardVariants;

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
};

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants[variant], className)} {...props} />
  )
);
Card.displayName = "Card";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6", className)} {...props} />
);
CardContent.displayName = "CardContent";

export { Card, CardContent };

/** Default export for `import Card from "@/components/ui/Card"` */
export default Card;
