"use client";

import Link from "next/link";
import Image from "next/image";
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
    <header className="bg-white shadow-md border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-2">
          <Link href="/" className="flex items-center text-brand-primary hover:text-[#005ca8]">
            <Image
              src="/images/ptlogo.png"
              alt="PropertyTools AI logo"
              width={540}
              height={162}
              className="h-12 md:h-14 w-auto rounded object-contain"
              priority
            />
          </Link>

          <button
            type="button"
            className="md:hidden p-2 rounded text-brand-text hover:bg-brand-surface"
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

        <nav className="hidden md:flex flex-wrap items-center justify-center gap-1 border-t border-gray-200 py-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2 text-brand-text hover:text-brand-primary text-sm font-medium rounded hover:bg-brand-surface"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {mobileOpen && (
          <nav className="md:hidden pb-4 border-t border-gray-200 pt-2">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-2 text-brand-text hover:text-brand-primary hover:bg-brand-surface rounded"
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
