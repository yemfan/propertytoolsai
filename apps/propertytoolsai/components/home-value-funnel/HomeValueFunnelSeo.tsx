import Link from "next/link";

const RELATED = [
  { href: "/mortgage-calculator", label: "Mortgage calculator" },
  { href: "/affordability-calculator", label: "Affordability calculator" },
  { href: "/ai-property-comparison", label: "AI property comparison" },
  { href: "/rent-vs-buy-calculator", label: "Rent vs buy calculator" },
  { href: "/refinance-calculator", label: "Refinance calculator" },
] as const;

export default function HomeValueFunnelSeo() {
  return (
    <div className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">How your home value is estimated</h2>
          <p className="text-sm leading-relaxed text-gray-600">
            We start from a local <strong className="font-medium text-gray-800">price per square foot</strong> baseline
            (using market data and comparable sales when available), then multiply by your living area. Adjustments account
            for beds and baths, lot size relative to the home, age, property type, condition, renovations, and recent
            market trend. The output is an <strong className="font-medium text-gray-800">estimated range</strong>, not a
            single guaranteed price — uncertainty is normal in automated models.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">What affects home value</h2>
          <ul className="list-inside list-disc space-y-2 text-sm text-gray-600">
            <li>Location and neighborhood demand</li>
            <li>Living square footage and layout (beds/baths)</li>
            <li>Lot size and usability</li>
            <li>Home age, condition, and updates</li>
            <li>Recent comparable sales and local market momentum</li>
          </ul>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">FAQ</h2>
          <dl className="space-y-6">
            <div>
              <dt className="font-medium text-gray-900">Is this an appraisal?</dt>
              <dd className="mt-1 text-sm text-gray-600">
                No. This is an automated estimate for planning and research. A licensed appraiser provides a formal
                opinion of value for lending and legal use.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-900">What does “confidence” mean?</dt>
              <dd className="mt-1 text-sm text-gray-600">
                Confidence reflects how complete your inputs are, how strong comparable sales coverage is, and how
                stable local market signals look. It is not a guarantee about accuracy.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-900">Why is there a range?</dt>
              <dd className="mt-1 text-sm text-gray-600">
                Homes don&apos;t have one true online price. A range reflects uncertainty from data gaps and market
                variability.
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-gray-900">More free tools</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {RELATED.map((r) => (
              <li key={r.href}>
                <Link href={r.href} className="text-sm font-medium text-[#0072ce] hover:underline">
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
