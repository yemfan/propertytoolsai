"use client";

import Link from "next/link";
import { useState } from "react";

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

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link href="/" className="text-2xl font-bold text-blue-600 hover:text-blue-700">
            PropertyToolsAI
          </Link>

          <nav className="hidden md:flex flex-wrap items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2 text-gray-700 hover:text-blue-600 text-sm font-medium rounded hover:bg-gray-50"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            className="md:hidden p-2 rounded text-gray-700 hover:bg-gray-100"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {mobileOpen && (
          <nav className="md:hidden pb-4 border-t border-gray-200 pt-2">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-2 text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded"
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
