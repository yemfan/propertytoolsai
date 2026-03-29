"use client";

import Link from "next/link";
import { trackEvent } from "@/lib/marketing/trackEvent";

export function SeoInternalLinks({
  items,
  seoPageSlug,
}: {
  items: Array<{ label: string; href: string }>;
  seoPageSlug?: string;
}) {
  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Explore more</h2>
      <div className="mt-4 flex flex-wrap gap-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-full border bg-gray-50 px-4 py-2 text-sm font-medium text-gray-900"
            onClick={() =>
              trackEvent("seo_internal_link_click", {
                href: item.href,
                label: item.label,
                seo_slug: seoPageSlug ?? null,
              })
            }
          >
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}