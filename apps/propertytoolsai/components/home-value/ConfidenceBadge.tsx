"use client";

import type { ConfidenceOutput } from "@/lib/homeValue/types";

type Props = {
  confidence: ConfidenceOutput;
  className?: string;
};

const levelStyles: Record<string, string> = {
  high: "bg-emerald-50 text-emerald-900 ring-emerald-200/80",
  medium: "bg-amber-50 text-amber-950 ring-amber-200/80",
  low: "bg-slate-100 text-slate-800 ring-slate-200/90",
};

export function ConfidenceBadge({ confidence, className = "" }: Props) {
  const ring = levelStyles[confidence.level] ?? levelStyles.low;
  return (
    <div
      className={`inline-flex flex-wrap items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${ring} ${className}`}
    >
      <span className="capitalize">{confidence.level}</span>
      <span className="font-medium opacity-80">confidence</span>
      <span className="tabular-nums text-[0.7rem] opacity-90">Score {Math.round(confidence.score)}</span>
    </div>
  );
}
