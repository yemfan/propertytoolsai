import type { SeoGeneratedPage } from "@/lib/seo-generator/types";
import { SeoCalculatorCTA } from "./SeoCalculatorCTA";
import { SeoFaq } from "./SeoFaq";
import { SeoHero } from "./SeoHero";
import { SeoInternalLinks } from "./SeoInternalLinks";
import { SeoListingsGrid } from "./SeoListingsGrid";
import { SeoPageViewTracker } from "./SeoPageViewTracker";
import { SeoStats } from "./SeoStats";

export function SeoLandingPage({ page }: { page: SeoGeneratedPage }) {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <SeoPageViewTracker slug={page.slug} template={page.template} />
      <div className="mx-auto max-w-7xl space-y-6">
        <SeoHero h1={page.h1} intro={page.intro} />
        <SeoStats items={page.stats} />
        <SeoListingsGrid query={page.listingsQuery} seoPageSlug={page.slug} />
        <SeoCalculatorCTA {...page.calculatorCta} seoPageSlug={page.slug} />
        <SeoFaq items={page.faq} />
        <SeoInternalLinks items={page.internalLinks} seoPageSlug={page.slug} />
      </div>
    </div>
  );
}
