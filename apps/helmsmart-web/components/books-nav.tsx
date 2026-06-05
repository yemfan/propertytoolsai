"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Overview",     href: "/books" },
  { label: "Transactions", href: "/books/transactions" },
  { label: "Invoices",     href: "/books/invoices" },
  { label: "Recurring",    href: "/books/invoices/recurring" },
  { label: "Estimates",    href: "/books/estimates" },
  { label: "Expenses",     href: "/books/expenses" },
  { label: "Bills",        href: "/books/bills" },
  { label: "Vendors",      href: "/books/vendors" },
  { label: "Journal",      href: "/books/journal" },
  { label: "Accounts",     href: "/books/accounts" },
  { label: "Aging",        href: "/books/aging" },
  { label: "Reports",      href: "/books/reports" },
] as const;

export function BooksNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-slate-200 mb-6 -mt-2">
      {TABS.map(({ label, href }) => {
        const active = (() => {
          if (href === "/books") return pathname === "/books";
          // /books/invoices should NOT activate when we're on the Recurring sub-page
          if (href === "/books/invoices") {
            return (
              pathname === "/books/invoices" ||
              (pathname.startsWith("/books/invoices/") &&
                !pathname.startsWith("/books/invoices/recurring"))
            );
          }
          return pathname === href || pathname.startsWith(`${href}/`);
        })();

        return (
          <Link
            key={href}
            href={href}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              active
                ? "text-indigo-600 border-b-2 border-indigo-600 -mb-px bg-white"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
