import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** “Close More Deals with Less Work” feature grid — top accent + gradient (shared with PropertyTools AI). */
export const featureHighlightAccents = {
  primary: {
    borderTop: "border-t-[#0072ce]",
    gradientFrom: "from-[#0072ce]/[0.06]",
  },
  primaryDark: {
    borderTop: "border-t-[#005ca8]",
    gradientFrom: "from-[#005ca8]/[0.06]",
  },
  success: {
    borderTop: "border-t-[#28a745]",
    gradientFrom: "from-[#28a745]/[0.07]",
  },
  accent: {
    borderTop: "border-t-[#ff8c42]",
    gradientFrom: "from-[#ff8c42]/[0.08]",
  },
} as const;

export type FeatureHighlightAccent = keyof typeof featureHighlightAccents;

export function FeatureHighlightCard({
  accent,
  title,
  description,
  className,
}: {
  accent: FeatureHighlightAccent;
  title: ReactNode;
  description: string;
  className?: string;
}) {
  const a = featureHighlightAccents[accent];
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/90 border-t-4 bg-gradient-to-b to-slate-50/80 p-6 text-center shadow-sm",
        a.borderTop,
        a.gradientFrom,
        className
      )}
    >
      <p className="font-heading font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
    </div>
  );
}
