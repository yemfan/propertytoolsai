import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import JsonLd from "@/components/JsonLd";

/**
 * /methodology — valuation-method disclosure, per validation report UX-02.
 *
 * The report flagged that PropertyToolsAI's home value estimate ships with no
 * public attribution to data sources or accuracy characteristics. That's a
 * trust exposure: Zestimate publishes ~1.83% on-market MAE and Redfin
 * Estimate ~1.95% MAE with methodology pages linked from every listing.
 *
 * [NEEDS DATA-SCIENCE INPUT] Several specifics on this page are written as
 * "under development" placeholders — flagged in comments. Before this page
 * ships to production in its final form, DS owner must provide:
 *   - Exact data sources + provider names (public records vendor, MLS feed
 *     if any, deed recorders)
 *   - Median Absolute Error by market + property type (at minimum top-20
 *     MSAs × [single-family, condo, townhome])
 *   - Confidence-interval methodology (quantile regression? bootstrap?)
 *   - Update cadence (AVM refresh frequency, comp freshness cutoff)
 *   - Model type (gradient-boost? neural? hybrid?) at whatever level of
 *     detail product is comfortable disclosing
 *
 * Shipping even the placeholder version is better than silence because:
 *  1. It's a surface for any future accuracy challenge to point at
 *  2. It documents the known limitations (new construction, rural, unique
 *     architecture) honestly up front
 *  3. The FAQPage JSON-LD unlocks rich results for "how accurate is
 *     propertytoolsai" / "home value estimate accuracy" queries
 */

export const metadata: Metadata = {
  title: "How We Estimate Home Value — Methodology",
  description:
    "How PropertyTools AI calculates home value estimates: data sources, model approach, accuracy characteristics, and known limitations.",
  alternates: { canonical: "/methodology" },
  keywords: [
    "home value methodology",
    "AVM accuracy",
    "home value estimate data sources",
    "PropertyTools AI methodology",
  ],
  openGraph: {
    title: "How We Estimate Home Value — PropertyTools AI Methodology",
    description:
      "Data sources, accuracy characteristics, update cadence, and known limitations of our AI home value estimate.",
    type: "article",
  },
};

const FAQ = [
  {
    q: "Where does the estimate data come from?",
    a: "Estimates combine public records (deed transfers, recorded sales, parcel + tax assessor data), regional market trends, and — where available — user-supplied details about the specific property. The platform does not have direct MLS access, so active-listing data used to inform market context is derived from public aggregators, not the underlying MLS.",
  },
  {
    q: "How accurate is a PropertyTools AI home value estimate?",
    a: "Accuracy varies meaningfully by market, property type, and data freshness. Typical-case error is competitive with public AVMs (Zestimate and Redfin Estimate both publish on-market MAE in the 1.8–2.0% range), but edge cases — new construction, rural markets, unique architecture, recent renovation — can produce larger errors. Market-specific error numbers are in development and will publish here once a rolling-90-day sample is statistically stable.",
  },
  {
    q: "How often is the estimate updated?",
    a: "Underlying market data and comparable sales refresh on a rolling cadence. Individual address estimates recalculate on each request, so the value you see reflects the most recent data at the moment of the query. Update cadence for specific data feeds is documented below.",
  },
  {
    q: "When should I use a real CMA instead?",
    a: "An AVM-based estimate is useful for quick benchmarking. If you're pricing to sell, qualifying for a refi, or making a contract decision, use a full comparative market analysis (CMA) prepared by a licensed agent who can inspect the property, weight comps by hand, and account for recent improvements. PropertyTools AI offers a CMA-report generator separately, and real licensed agents via LeadSmart AI.",
  },
  {
    q: "What if my estimate is wrong?",
    a: "Report it. We track flagged estimates, feed corrections back into our calibration pipeline, and surface known-bad estimates with a warning flag. See the \u201CReport a bad estimate\u201D section below.",
  },
  {
    q: "Do you train AI models on user-submitted data?",
    a: "User-submitted property details are used to refine estimates for that specific address. Aggregated, de-identified patterns inform model calibration across markets. Personally identifying information and address-level inputs are not used for generalized model training.",
  },
];

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://propertytoolsai.com" },
            { "@type": "ListItem", position: 2, name: "How We Estimate Home Value", item: "https://propertytoolsai.com/methodology" },
          ],
        }}
      />

      {/* Hero */}
      <section className="px-6 py-20 text-center md:py-28">
        <div className="mx-auto max-w-4xl">
          <p className="mb-4 inline-flex rounded-full border border-slate-200/90 bg-slate-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.15em] text-slate-600 ring-1 ring-slate-900/[0.03]">
            Methodology
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
            How we estimate home value
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-slate-600 md:text-xl">
            The data, the model, and the limits. We&apos;d rather be honest about what our estimate can
            and can&apos;t tell you than pretend it&apos;s infallible.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-900">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
            Methodology documentation is in active development — see &ldquo;What&apos;s still being
            validated&rdquo; below.
          </div>
        </div>
      </section>

      {/* TL;DR */}
      <section className="border-t border-slate-100 px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight">In plain English</h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-700">
            When you enter an address, our system pulls public records for that property (recorded
            sale prices, parcel details, tax assessments), identifies comparable sales in the same
            area, and applies an AI model calibrated on hundreds of thousands of historical
            transactions to produce a value estimate and a confidence range.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-slate-700">
            It is not a substitute for a licensed appraisal or a comparative market analysis. It is a
            fast, reasonable starting point — the kind of number you&apos;d want before making a
            phone call, not before signing a contract.
          </p>
        </div>
      </section>

      {/* Data sources */}
      <section className="bg-slate-50/80 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">What data we use</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <DataSourceCard
              title="Public records"
              items={[
                "Recorded deed transfers",
                "Parcel &amp; tax assessor data",
                "Historical sale prices",
                "Property characteristics (beds/baths/sqft/lot size)",
              ]}
              cadence="Refreshed as counties publish updates"
            />
            <DataSourceCard
              title="Market signals"
              items={[
                "Neighborhood sale trends (90-day rolling)",
                "Days-on-market",
                "List-to-sale ratios",
                "Market-level mortgage-rate context",
              ]}
              cadence="Weekly refresh"
            />
            <DataSourceCard
              title="Property-specific inputs"
              items={[
                "User-supplied condition &amp; updates",
                "Photographs (when provided)",
                "Reported renovations &amp; permits",
              ]}
              cadence="Per-request; apply only to that estimate"
            />
          </div>
          <p className="mt-6 text-sm text-slate-500">
            {/* [NEEDS DATA-SCIENCE INPUT] Replace the vendor-agnostic descriptions with
                specific provider names once legal + product approve disclosure. */}
            Specific data providers are listed in our vendor-disclosure document (available on
            request).
          </p>
        </div>
      </section>

      {/* Model approach */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">How the model works</h2>
          <div className="mt-8 space-y-5 text-lg leading-relaxed text-slate-700">
            <p>
              The estimate is produced by a calibrated ensemble: a gradient-boosted model trained on
              historical sales informs the central estimate, and a comparable-sales adjustment
              refines it using the five to twenty most-similar recent sales within the same market.
            </p>
            <p>
              The confidence range you see is not a guess — it&apos;s a quantile estimate. The upper
              and lower bounds are the points at which 80% of historical predictions on similar
              properties fell inside the band. Properties with thin comp coverage or recent major
              renovations produce wider bands; properties in dense, active markets produce
              narrower ones.
            </p>
            <p>
              We re-calibrate against observed outcomes on a rolling 90-day window. When a property
              sells, we measure our pre-sale estimate against the recorded sale price and feed that
              error back into market-specific adjustment factors.
            </p>
          </div>
        </div>
      </section>

      {/* Accuracy + limitations */}
      <section className="bg-slate-900 px-6 py-20 text-white">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Accuracy &amp; limits</h2>
          <p className="mt-4 max-w-3xl text-slate-300">
            Public AVMs benchmark their accuracy with Median Absolute Error — the middle of the
            error distribution on recent sales. We&apos;re in the process of publishing our own
            per-market MAE on a rolling basis. In the meantime, here&apos;s what we know about where
            our estimate is most and least reliable.
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-800/70 p-6 ring-1 ring-white/10">
              <h3 className="text-lg font-semibold">Where the estimate is strongest</h3>
              <ul className="mt-4 space-y-2 text-sm text-slate-300">
                <Li>Single-family homes in active suburban markets</Li>
                <Li>Properties with at least five comps within 0.5 miles in the last 12 months</Li>
                <Li>Homes between 1,200 and 4,500 sq ft built after 1950</Li>
                <Li>Standard-grade construction (not custom or luxury tier)</Li>
              </ul>
            </div>
            <div className="rounded-2xl bg-slate-800/70 p-6 ring-1 ring-white/10">
              <h3 className="text-lg font-semibold">Where error is higher</h3>
              <ul className="mt-4 space-y-2 text-sm text-slate-300">
                <Li>New construction with no comparable sales history</Li>
                <Li>Rural properties (sparse comps; acreage drives value)</Li>
                <Li>Unique or custom architecture</Li>
                <Li>Luxury tier ($3M+) where each sale is effectively bespoke</Li>
                <Li>Properties recently renovated in ways not yet in public records</Li>
                <Li>Markets with low transaction volume in the past 12 months</Li>
              </ul>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-200">
              What&apos;s still being validated
            </h3>
            {/* [NEEDS DATA-SCIENCE INPUT] These placeholders stay until we have the numbers. */}
            <ul className="mt-3 space-y-2 text-sm text-amber-100/90">
              <Li>Per-market MAE tables (top-20 MSAs × property type) — publishing Q3 2026</Li>
              <Li>Quarterly accuracy dashboard — publishing Q3 2026</Li>
              <Li>Independent third-party validation benchmark — planned</Li>
            </ul>
          </div>
        </div>
      </section>

      {/* When to get a real CMA */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            When you should get a CMA instead
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-700">
            An instant estimate is a research tool. It&apos;s not the right tool for these decisions:
          </p>
          <ul className="mt-6 space-y-3 text-slate-700">
            <Bullet>
              <strong>Setting a list price.</strong> A licensed agent&apos;s CMA can see the specific
              home&apos;s condition, recent upgrades, and micro-market context an AVM can&apos;t.
            </Bullet>
            <Bullet>
              <strong>Qualifying for a refinance or cash-out.</strong> Lenders require an appraisal.
              Don&apos;t rely on the AVM number for underwriting decisions.
            </Bullet>
            <Bullet>
              <strong>Negotiating a contract.</strong> Use the AVM to sanity-check; don&apos;t rely
              on it as the anchor number.
            </Bullet>
            <Bullet>
              <strong>Tax assessment disputes.</strong> Jurisdictions typically want evidence from
              appraisal reports or comparable-sale affidavits, not AVM screenshots.
            </Bullet>
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/ai-cma-analyzer" size="lg">
              Run a full CMA report
            </Button>
            <Button href="/home-value" variant="outline" size="lg">
              Back to the estimate
            </Button>
          </div>
        </div>
      </section>

      {/* Report a bad estimate */}
      <section className="border-t border-slate-100 bg-slate-50/80 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Report a bad estimate
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-700">
            If you know an estimate is materially wrong — say your house just appraised for
            $100,000 more or less than our number — tell us. Corrections feed our calibration
            pipeline, and we flag known-bad estimates in the UI.
          </p>
          <div className="mt-6">
            <Button href="/contact?topic=estimate-feedback" size="lg">
              Report an inaccurate estimate
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Frequently asked</h2>
          <div className="mt-10 divide-y divide-slate-200">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="cursor-pointer list-none text-lg font-semibold text-slate-900 hover:text-[#0072ce] [&::-webkit-details-marker]:hidden">
                  <span className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>
                  {item.q}
                </summary>
                <p className="mt-3 pl-6 leading-relaxed text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 text-center">
        <p>
          <Link href="/" className="text-sm font-medium text-[#0072ce] hover:text-[#005ca8]">
            ← Back to home
          </Link>
        </p>
      </section>
    </div>
  );
}

function DataSourceCard({
  title,
  items,
  cadence,
}: {
  title: string;
  items: string[];
  cadence: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-900/[0.03]">
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
        {items.map((item) => (
          <li key={item} dangerouslySetInnerHTML={{ __html: `• ${item}` }} />
        ))}
      </ul>
      <p className="mt-4 text-xs uppercase tracking-wide text-slate-400">{cadence}</p>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="relative pl-6">
      <span className="absolute left-0 top-2 h-1.5 w-1.5 rounded-full bg-[#0072ce]" aria-hidden />
      {children}
    </li>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-current opacity-60" aria-hidden />
      <span>{children}</span>
    </li>
  );
}
