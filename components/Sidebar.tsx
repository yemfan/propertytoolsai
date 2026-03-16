\"use client\";

import Link from \"next/link\";
import { usePathname } from \"next/navigation\";
import { useState } from \"react\";

const calculatorLinks = [
  { href: \"/mortgage-calculator\", label: \"Mortgage\" },
  { href: \"/refinance-calculator\", label: \"Refinance\" },
  { href: \"/affordability-calculator\", label: \"Affordability\" },
  { href: \"/rent-vs-buy-calculator\", label: \"Rent vs Buy\" },
  { href: \"/closing-cost-estimator\", label: \"Closing Costs\" },
  { href: \"/property-investment-analyzer\", label: \"Investment Analyzer\" },
  { href: \"/down-payment-calculator\", label: \"Down Payment\" },
  { href: \"/hoa-fee-tracker\", label: \"HOA Tracker\" },
  { href: \"/cash-flow-calculator\", label: \"Cash Flow\" },
  { href: \"/cap-rate-roi-calculator\", label: \"Cap Rate & ROI\" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const NavItems = () => (
    <nav className=\"mt-4 space-y-1\">
      <Link
        href=\"/\"
        className={`flex items-center rounded-md px-3 py-2 text-sm font-medium ${
          pathname === \"/\"
            ? \"bg-blue-50 text-blue-700\"
            : \"text-gray-700 hover:bg-gray-50 hover:text-blue-600\"
        }`}
        onClick={() => setOpen(false)}
      >
        Home
      </Link>
      <div className=\"mt-3 text-xs font-semibold uppercase tracking-wide text-gray-400 px-3\">
        Calculators
      </div>
      {calculatorLinks.map((item) => {
        const active =
          pathname === item.href || pathname?.startsWith(item.href + \"/\");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center rounded-md px-3 py-2 text-sm ${
              active
                ? \"bg-blue-50 text-blue-700 font-semibold\"
                : \"text-gray-700 hover:bg-gray-50 hover:text-blue-600\"
            }`}
            onClick={() => setOpen(false)}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className=\"hidden md:flex md:w-64 md:flex-col border-r border-gray-200 bg-white\">
        <div className=\"flex-1 px-4 py-6 overflow-y-auto\">
          <div className=\"text-sm font-semibold text-gray-500 tracking-wide uppercase\">
            AI Property Tools
          </div>
          <NavItems />
        </div>
      </aside>

      {/* Mobile toggle button */}
      <button
        type=\"button\"
        className=\"fixed bottom-4 left-4 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-md md:hidden\"
        onClick={() => setOpen(true)}
        aria-label=\"Open navigation\"
      >
        <svg className=\"h-5 w-5\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\">
          <path
            strokeLinecap=\"round\"
            strokeLinejoin=\"round\"
            strokeWidth={2}
            d=\"M4 6h16M4 12h16M4 18h16\"
          />
        </svg>
      </button>

      {/* Mobile drawer */}
      {open && (
        <div className=\"fixed inset-0 z-40 md:hidden\">
          <div
            className=\"absolute inset-0 bg-black/40\"
            onClick={() => setOpen(false)}
          />
          <aside className=\"absolute inset-y-0 left-0 w-72 bg-white shadow-xl p-4\">
            <div className=\"flex items-center justify-between\">
              <span className=\"text-sm font-semibold text-gray-600\">
                AI Property Tools
              </span>
              <button
                type=\"button\"
                className=\"p-2 rounded-full hover:bg-gray-100 text-gray-600\"
                onClick={() => setOpen(false)}
                aria-label=\"Close navigation\"
              >
                <svg
                  className=\"h-5 w-5\"
                  fill=\"none\"
                  stroke=\"currentColor\"
                  viewBox=\"0 0 24 24\"
                >
                  <path
                    strokeLinecap=\"round\"
                    strokeLinejoin=\"round\"
                    strokeWidth={2}
                    d=\"M6 18L18 6M6 6l12 12\"
                  />
                </svg>
              </button>
            </div>
            <NavItems />
          </aside>
        </div>
      )}
    </>
  );
}

