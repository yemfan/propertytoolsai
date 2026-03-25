"use client";

import Link from "next/link";
import { trackEvent } from "@/lib/marketing/trackEvent";

export function SeoCalculatorCTA({
  label,
  href,
  description,
  seoPageSlug,
}: {
  label: string;
  href: string;
  description: string;
  seoPageSlug?: string;
}) {
  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
      <h2 className="text-xl font-semibold text-gray-900">Take the next step</h2>
      <p className="mt-3 text-sm leading-relaxed text-gray-600 md:text-base">{description}</p>
      <div className="mt-5">
        <Link
          href={href}
          className="inline-block rounded-2xl bg-gray-900 px-5 py-3 text-sm font-medium text-white"
          onClick={() =>
            trackEvent("seo_calculator_cta_click", { href, seo_slug: seoPageSlug ?? null })
          }
        >
          {label}
        </Link>
      </div>
    </section>
  );
}