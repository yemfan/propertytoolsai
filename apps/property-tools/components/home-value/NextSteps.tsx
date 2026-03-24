"use client";

import Link from "next/link";
import type { ToolkitRecommendation } from "@/lib/homeValue/types";

type Props = {
  recommendations: ToolkitRecommendation[];
};

export function NextSteps({ recommendations }: Props) {
  if (!recommendations.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/80 p-6 shadow-sm md:p-8">
      <h3 className="text-lg font-semibold text-slate-900">Recommended next steps</h3>
      <p className="mt-1 text-sm text-slate-600">Tools picked for your situation — continue in one click.</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {recommendations.map((rec) => (
          <li key={rec.href}>
            <Link
              href={rec.href}
              className="group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#0072ce]/35 hover:shadow-md"
            >
              <span className="text-sm font-semibold text-slate-900 group-hover:text-[#0072ce]">{rec.title}</span>
              <span className="mt-2 flex-1 text-xs leading-relaxed text-slate-600">{rec.reason}</span>
              <span className="mt-4 text-xs font-semibold text-[#0072ce]">Open tool →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
