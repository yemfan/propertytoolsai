"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavGroup = {
  title: string;
  items: Array<{ href: string; label: string }>;
};

const navGroups: NavGroup[] = [
  {
    title: "Home Value",
    items: [
      { href: "/home-value", label: "Estimate" },
      { href: "/smart-cma-builder", label: "CMA Report" },
      { href: "/market-report/los-angeles-ca", label: "Price Trends" },
    ],
  },
  {
    title: "Financing",
    items: [
      { href: "/mortgage-calculator", label: "Mortgage Calculator" },
      { href: "/affordability-calculator", label: "Affordability" },
      { href: "/refinance-calculator", label: "Refinance" },
    ],
  },
  {
    title: "Market Intelligence",
    items: [
      { href: "/market-report/los-angeles-ca", label: "Market Trends" },
      { href: "/property-investment-analyzer", label: "Investment Analysis" },
      { href: "/ai-property-comparison", label: "AI Property Compare" },
      { href: "/rent-vs-buy-calculator", label: "Rent vs Buy" },
    ],
  },
];

export default function Sidebar({
  mobileOpen = false,
  onNavigate,
}: {
  mobileOpen?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-60 border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="h-full overflow-y-auto px-4 py-5">
        <Link href="/" className="mb-6 block">
          <Image
            src="/images/ptlogo.png"
            alt="PropertyTools AI"
            width={216}
            height={48}
            className="h-12 w-auto"
            priority
          />
        </Link>

        <nav className="space-y-6">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-2">
              <div className="px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {group.title}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/" && pathname?.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={`block rounded-lg px-2.5 py-2 text-sm transition-colors ${
                        active
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}

export { navGroups };

