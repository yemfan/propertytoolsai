"use client";

import Link from "next/link";

/** Inline CTA strip for tool pages — links to signup or a calculator. */
export default function SmartGrowthCta(props: {
  headline?: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  const headline = props.headline ?? "Save this run — share with your agent";
  return (
    <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <p className="text-sm font-semibold text-slate-900">{headline}</p>
      <div className="flex flex-wrap gap-2">
        <Link
          href={props.primaryHref}
          className="inline-flex items-center justify-center rounded-xl bg-blue-600 text-white text-sm font-semibold px-4 py-2"
        >
          {props.primaryLabel}
        </Link>
        {props.secondaryHref && props.secondaryLabel && (
          <Link
            href={props.secondaryHref}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white text-sm font-semibold px-4 py-2"
          >
            {props.secondaryLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
