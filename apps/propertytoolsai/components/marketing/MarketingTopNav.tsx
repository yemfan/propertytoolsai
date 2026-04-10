"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import PropertyToolsLogo from "@/components/brand/PropertyToolsLogo";
import { useAuth } from "@/components/AuthProvider";

/**
 * Marketing top navigation for unauthenticated visitors.
 *
 * This replaces the 272px product sidebar (`AppShell` / `PremiumSidebar`) on
 * public marketing pages — homepage, pricing, tool landing pages, blog, about,
 * contact, legal. A first-time visitor arriving from search or an ad expects
 * a conventional horizontal top nav, not an in-app sidebar exposing every
 * sub-tool and "Account / Profile / Support" to a stranger.
 *
 * Design:
 *   - Sticky header with a subtle blur and hairline border
 *   - Logo left (uses the shared PropertyToolsLogo component)
 *   - Horizontal nav links center (Tools / Pricing / For Agents / Blog)
 *   - "Sign in" ghost button + "Start free" gradient CTA on the right
 *   - Mobile: links collapse into a drawer behind a hamburger
 *
 * Auth: uses the existing `useAuth()` context to open the login/signup modal
 * so the user flow is identical to the rest of the app.
 */

type NavLink = {
  label: string;
  href: string;
};

const NAV_LINKS: NavLink[] = [
  { label: "Tools", href: "/#tools" },
  { label: "Pricing", href: "/pricing" },
  { label: "For Agents", href: "/agent-signup" },
  { label: "Blog", href: "/blog" },
];

export default function MarketingTopNav() {
  const pathname = usePathname();
  const { openAuth } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile drawer on route change so tapping a link actually
  // dismisses the menu even when pathname doesn't change (e.g. /#tools).
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-xl backdrop-saturate-150 dark:border-slate-800/70 dark:bg-slate-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="flex shrink-0 items-center rounded-lg py-1 outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#0072ce]/40"
          aria-label="PropertyTools AI — Home"
        >
          <PropertyToolsLogo />
        </Link>

        {/* Desktop links */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0072ce]/40 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <button
            type="button"
            onClick={() => openAuth("login")}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0072ce]/40 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => openAuth("signup")}
            className="relative inline-flex items-center rounded-xl bg-gradient-to-r from-[#0072ce] to-[#4F46E5] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#0072ce]/25 transition-all duration-200 hover:shadow-lg hover:shadow-[#0072ce]/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0072ce]/40 active:scale-[0.97]"
          >
            Start free
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="marketing-mobile-menu"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0072ce]/40 md:hidden dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div
          id="marketing-mobile-menu"
          className="border-t border-slate-200/70 bg-white px-4 pb-6 pt-3 md:hidden dark:border-slate-800/70 dark:bg-slate-950"
        >
          <nav className="flex flex-col" aria-label="Primary mobile">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0072ce]/40 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2 border-t border-slate-200/70 pt-4 dark:border-slate-800/70">
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                openAuth("login");
              }}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0072ce]/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                openAuth("signup");
              }}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-[#0072ce] to-[#4F46E5] text-sm font-semibold text-white shadow-md shadow-[#0072ce]/25 transition-all hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0072ce]/40 active:scale-[0.97]"
            >
              Start free
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
