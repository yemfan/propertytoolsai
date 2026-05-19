"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getFinancialServicesTheme } from "@/lib/financial-services/theme";

const NAV = [
  { href: "/financial-services/dashboard/overview", label: "Overview" },
  { href: "/financial-services/dashboard/fna", label: "FNA" },
  { href: "/financial-services/dashboard/recruits", label: "Recruits" },
  { href: "/financial-services/dashboard/templates", label: "Templates" },
];

function lightAccentClass(accentText: string): string {
  if (accentText.includes("amber")) return "text-amber-600";
  if (accentText.includes("red")) return "text-red-600";
  if (accentText.includes("emerald")) return "text-emerald-600";
  return "text-indigo-600";
}

export default function FinancialServicesTopNav({ email }: { email: string | null }) {
  const theme = getFinancialServicesTheme();
  const pathname = usePathname() ?? "";
  const accentClass = lightAccentClass(theme.accentText);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 pt-4 md:px-8">
        <Link
          href="/financial-services"
          className="text-sm font-semibold tracking-tight text-slate-900"
        >
          {theme.partnerName ? (
            <span>
              <span className="text-slate-500">LeadSmart AI ×</span>{" "}
              <span className={accentClass}>{theme.partnerName}</span>
            </span>
          ) : (
            "LeadSmart AI"
          )}
        </Link>
        <div className="flex items-center gap-3">
          {email && (
            <span className="hidden text-xs text-slate-500 md:inline">{email}</span>
          )}
          <Link
            href="/logout"
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Sign out
          </Link>
        </div>
      </div>

      <nav className="mx-auto max-w-7xl px-4 md:px-8">
        <ul className="-mb-px flex gap-1 overflow-x-auto">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  className={[
                    "inline-flex items-center border-b-2 px-3 py-2.5 text-sm transition",
                    active
                      ? "border-slate-900 font-semibold text-slate-900"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
