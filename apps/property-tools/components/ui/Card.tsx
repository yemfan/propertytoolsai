import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * LeadSmart-style surfaces: soft ring + shadow, optional hover lift (interactive).
 * Matches `leadsmart-ai` marketing cards: `rounded-xl border-slate-200/90`, subtle depth.
 */
export const cardVariants = {
  default:
    "rounded-xl border border-slate-200/90 bg-white text-slate-950 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.04]",
  /** Links / clickable tiles — hover lift + brand-tint border */
  interactive:
    "rounded-xl border border-slate-200/90 bg-white text-slate-950 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.04] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/[0.08] hover:border-[#0072ce]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0072ce]/30",
  muted:
    "rounded-xl border border-slate-200/70 bg-slate-50/90 text-slate-950 shadow-sm",
  flat: "rounded-xl border border-slate-200/80 bg-white text-slate-950",
  /** Nested blocks inside a card (briefing panels, etc.) */
  inset: "rounded-lg border border-slate-100 bg-slate-50/60",
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
