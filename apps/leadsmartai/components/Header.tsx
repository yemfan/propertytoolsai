"use client";

import Link from "next/link";
import { useState } from "react";
import { LeadSmartLogo } from "@/components/brand/LeadSmartLogo";
import HeaderAuthActions from "@/components/HeaderAuthActions";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/mortgage-calculator", label: "Mortgage Calculator" },
  { href: "/refinance-calculator", label: "Refinance Calculator" },
  { href: "/adjustable-rate-calculator", label: "ARM Calculator" },
  { href: "/affordability-calculator", label: "Affordability Calculator" },
  { href: "/down-payment-calculator", label: "Down Payment Calculator" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

/** @deprecated Replaced by `@repo/ui` `Topbar` in `AppShell`. Not mounted. */
export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex items-center justify-between gap-3 py-3">
          <Link href="/" className="flex min-w-0 items-center transition-opacity hover:opacity-90">
            <LeadSmartLogo className="max-w-[min(100%,360px)]" />
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <HeaderAuthActions />
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 md:hidden dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        <nav className="hidden items-center justify-center gap-1 border-t border-slate-200/80 py-2 md:flex dark:border-slate-800">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-[#0072ce] dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-[#4da3e8]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {mobileOpen && (
          <nav className="border-t border-slate-200/80 pb-4 pt-2 md:hidden dark:border-slate-800">
            <div className="flex flex-col gap-0.5">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-[#0072ce] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-[#4da3e8]"
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
