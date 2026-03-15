import Link from "next/link";

const allTools = [
  { name: "Mortgage Calculator", href: "/mortgage-calculator" },
  { name: "Refinance Calculator", href: "/refinance-calculator" },
  { name: "Adjustable Rate Calculator", href: "/adjustable-rate-calculator" },
  { name: "Affordability Calculator", href: "/affordability-calculator" },
  { name: "Down Payment Calculator", href: "/down-payment-calculator" },
];

export default function ToolLinks({ excludeHref }: { excludeHref?: string }) {
  const tools = excludeHref ? allTools.filter((t) => t.href !== excludeHref) : allTools;
  return (
    <section className="rounded-lg border border-gray-200 bg-gray-50 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Try Other Real Estate Tools
      </h3>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {tools.map((tool) => (
          <li key={tool.href}>
            <Link
              href={tool.href}
              className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-2"
            >
              <span>{tool.name}</span>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
