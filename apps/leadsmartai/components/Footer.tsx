import Link from "next/link";
import { CookieSettingsLink } from "@/components/cookie-consent/CookieConsent";

const productLinks = [
  { label: "Lead Management", href: "/dashboard" },
  { label: "AI Deal Assistant", href: "/deal-assistant" },
  { label: "Client Portal", href: "/client/dashboard" },
  { label: "AI CMA Analyzer", href: "/ai-cma-analyzer" },
  { label: "Automations", href: "/dashboard/automation" },
  { label: "Mobile App", href: "/start-free" },
];

const companyLinks = [
  { label: "About", href: "/about" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact", href: "/contact" },
  // "Blog" link removed until we have a proper `/blog` index page.
  // Currently only `/blog/<slug>` sub-routes exist (cap-rate content),
  // and `/blog` itself returns 404 — which is a broken promise on a
  // credibility page. Restore this link when the index exists AND
  // the content is LeadSmart-branded (agent CRM) rather than
  // PropertyTools cap-rate material.
];

const resourceLinks = [
  { label: "Mortgage Calculator", href: "/mortgage-calculator" },
  { label: "Cap Rate Calculator", href: "/cap-rate-calculator" },
  { label: "Cash Flow Calculator", href: "/cash-flow-calculator" },
  { label: "ROI Calculator", href: "/roi-calculator" },
  { label: "Affordability Calculator", href: "/affordability-calculator" },
  { label: "Home Value Estimator", href: "/home-value-estimator" },
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
              Product
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
              LS
            </div>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              LeadSmart AI
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
            <CookieSettingsLink className="hover:text-[#0072ce] hover:underline dark:hover:text-[#4da3e8]" />
            <span>
              &copy; {new Date().getFullYear()} LeadSmart AI. All rights reserved.
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
