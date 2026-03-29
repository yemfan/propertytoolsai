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
    <header className="border-b border-gray-200 bg-white shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between gap-3 py-2">
          <Link href="/" className="flex min-w-0 items-center text-brand-primary hover:opacity-90">
            <LeadSmartLogo className="max-w-[min(100%,360px)]" />
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <HeaderAuthActions />
            <button
              type="button"
              className="rounded p-2 text-brand-text hover:bg-brand-surface md:hidden"
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

        <nav className="hidden flex-wrap items-center justify-center gap-1 border-t border-gray-200 py-2 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded px-3 py-2 text-sm font-medium text-brand-text hover:bg-brand-surface hover:text-brand-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {mobileOpen ? (
          <nav className="border-t border-gray-200 pb-4 pt-2 md:hidden">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded px-3 py-2 text-brand-text hover:bg-brand-surface hover:text-brand-primary"
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
