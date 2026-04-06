import Link from "next/link";

const productLinks = [
  { label: "Mortgage Calculator", href: "/mortgage-calculator" },
  { label: "Home Value Estimator", href: "/home-value-estimator" },
  { label: "Cap Rate Calculator", href: "/cap-rate-calculator" },
  { label: "Affordability Calculator", href: "/affordability-calculator" },
  { label: "AI Deal Analyzer", href: "/ai-real-estate-deal-analyzer" },
  { label: "AI CMA Analyzer", href: "/ai-cma-analyzer" },
];

const companyLinks = [
  { label: "About", href: "/about" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact", href: "/contact" },
  { label: "Blog", href: "/blog" },
];

const resourceLinks = [
  { label: "Refinance Calculator", href: "/refinance-calculator" },
  { label: "Down Payment Calculator", href: "/down-payment-calculator" },
  { label: "Cash Flow Calculator", href: "/cash-flow-calculator" },
  { label: "ROI Calculator", href: "/roi-calculator" },
  { label: "Rent vs Buy", href: "/rent-vs-buy-calculator" },
  { label: "Closing Cost Estimator", href: "/closing-cost-estimator" },
];

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
];

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200/80 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-6xl px-6 py-12 lg:py-16">
        {/* Main grid */}
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-slate-900 dark:text-white">
              Tools
            </h3>
            <ul className="mt-4 space-y-2.5">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 transition-colors hover:text-[#0072ce] dark:text-slate-400 dark:hover:text-[#4da3e8]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-slate-900 dark:text-white">
              Company
            </h3>
            <ul className="mt-4 space-y-2.5">
              {companyLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 transition-colors hover:text-[#0072ce] dark:text-slate-400 dark:hover:text-[#4da3e8]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-slate-900 dark:text-white">
              Resources
            </h3>
            <ul className="mt-4 space-y-2.5">
              {resourceLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 transition-colors hover:text-[#0072ce] dark:text-slate-400 dark:hover:text-[#4da3e8]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-slate-900 dark:text-white">
              Legal
            </h3>
            <ul className="mt-4 space-y-2.5">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 transition-colors hover:text-[#0072ce] dark:text-slate-400 dark:hover:text-[#4da3e8]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-200/80 pt-8 sm:flex-row dark:border-slate-800">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0072ce] text-xs font-bold text-white">
              PT
            </div>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              PropertyTools AI
            </span>
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500">
            &copy; {new Date().getFullYear()} PropertyTools AI. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
