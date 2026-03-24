import Link from "next/link";

const LEADSMART_URL = process.env.NEXT_PUBLIC_LEADSMART_URL ?? "https://leadsmart.ai";

const tools = [
  {
    title: "Home Value Estimate",
    description: "Get an instant estimate of your property's value.",
    href: "/home-value",
    featured: true,
  },
  {
    title: "Mortgage Calculator",
    description: "Calculate your monthly mortgage payment.",
    href: "/mortgage-calculator",
  },
  {
    title: "Affordability Calculator",
    description: "Find out how much house you can afford.",
    href: "/affordability-calculator",
  },
  {
    title: "Refinance Calculator",
    description: "See if refinancing saves you money.",
    href: "/refinance-calculator",
  },
  {
    title: "Rent vs Buy",
    description: "Compare renting vs buying scenarios.",
    href: "/rent-vs-buy-calculator",
  },
  {
    title: "AI Property Comparison",
    description: "Compare properties side by side using AI.",
    href: "/ai-property-comparison",
  },
] as const;

/** Internal SEO-style links → real routes (see `growth/seo` for city + tool combos). */
const exploreLinks = [
  { label: "Home Value in Los Angeles", href: "/growth/seo/home-value-estimator/los-angeles-ca" },
  { label: "Mortgage Calculator California", href: "/growth/seo/mortgage-calculator/los-angeles-ca" },
  { label: "Affordability Calculator 2026", href: "/affordability-calculator" },
  { label: "Rent vs Buy Los Angeles", href: "/growth/seo/rent-vs-buy-calculator/los-angeles-ca" },
] as const;

/**
 * Simpler marketing homepage variant. To use it, render from `app/page.tsx` instead of `PropertyToolsPage`.
 */
export default function PropertyToolsHomePage() {
  return (
    <div className="bg-white">
      <section className="px-4 py-16 text-center md:px-6 md:py-24">
        <h1 className="text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl">
          Free Real Estate Tools for Smarter Decisions
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
          Estimate home value, calculate mortgage payments, compare properties, and explore affordability — all in one
          place.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/home-value"
            className="rounded-2xl bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-800"
          >
            Get Home Value Estimate
          </Link>

          <Link
            href="#tools"
            className="rounded-2xl border px-6 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50"
          >
            Explore All Tools
          </Link>
        </div>
      </section>

      <section id="tools" className="bg-gray-50 px-4 py-12 md:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-semibold text-gray-900">Popular Tools</h2>

          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {tools.map((tool) => (
              <Link
                key={tool.title}
                href={tool.href}
                className={`rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md ${
                  tool.featured ? "border-gray-900" : ""
                }`}
              >
                <h3 className="text-lg font-semibold text-gray-900">{tool.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{tool.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 md:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-2xl font-semibold text-gray-900">Why People Use PropertyToolsAI</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              "Fast estimates in seconds",
              "Simple and easy to use",
              "Designed for real decisions",
              "No sign-up required to start",
            ].map((item) => (
              <div key={item} className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 px-4 py-12 md:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-xl font-semibold text-gray-900">Explore More</h2>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {exploreLinks.map((link) => (
              <Link key={link.label} href={link.href} className="text-sm text-gray-700 hover:underline">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 md:px-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-semibold text-gray-900">Frequently Asked Questions</h2>

          <div className="mt-6 space-y-4">
            {[
              {
                q: "How accurate is a home value estimate?",
                a: "Estimates are based on market data and comparable properties, but actual value may vary.",
              },
              {
                q: "How much house can I afford?",
                a: "It depends on your income, debt, and interest rates. Use our affordability calculator to find out.",
              },
              {
                q: "Is it better to rent or buy?",
                a: "It depends on your financial situation and long-term plans. Our rent vs buy tool helps compare both.",
              },
            ].map((faq) => (
              <div key={faq.q} className="rounded-xl border p-4">
                <div className="font-medium text-gray-900">{faq.q}</div>
                <div className="mt-1 text-sm text-gray-600">{faq.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 px-4 py-12 text-center md:px-6">
        <h3 className="text-lg font-semibold text-gray-900">For Real Estate Professionals</h3>
        <p className="mt-2 text-sm text-gray-600">Looking for lead management and client tools?</p>
        <a
          href={LEADSMART_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block text-sm font-medium text-gray-900 underline"
        >
          Explore LeadSmart AI
        </a>
      </section>
    </div>
  );
}
