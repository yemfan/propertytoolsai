"use client";

import Link from "next/link";
import { useAccess } from "@/components/AccessProvider";
import { usePathname } from "next/navigation";

const routeNames: Record<string, string> = {
  "home-value": "Home Value",
  "smart-cma-builder": "CMA Report",
  "mortgage-calculator": "Mortgage Calculator",
  "affordability-calculator": "Affordability",
  "refinance-calculator": "Refinance",
  "property-investment-analyzer": "Investment Analysis",
  "ai-property-comparison": "AI Property Compare",
  "rent-vs-buy-calculator": "Rent vs Buy",
  "market-report": "Market Trends",
};

export default function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { tier, openAuth, openPaywall, loading } = useAccess();
  const pathname = usePathname() ?? "/";
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg) => routeNames[seg] ?? seg);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-700 lg:hidden"
          >
            Menu
          </button>
          {crumbs.length > 0 ? (
            <div className="hidden truncate text-xs font-medium text-slate-500 md:block">
              {crumbs.join(" / ")}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {tier === "guest" ? (
            <button
              type="button"
              onClick={() => openAuth("login")}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 sm:text-sm"
            >
              Sign in
            </button>
          ) : null}
          {tier === "premium" ? (
            <span className="hidden rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 sm:inline">
              Premium
            </span>
          ) : (
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Upgrade
            </Link>
          )}
          {tier === "premium" ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800">
              P
            </div>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
              {tier === "guest" ? "G" : "F"}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

