"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { PremiumSidebar, Topbar } from "@repo/ui";
import { LeadSmartLogo } from "@/components/brand/LeadSmartLogo";
import HeaderAuthActions from "@/components/HeaderAuthActions";
import marketingNavConfig, { leadSmartMarketingNav } from "@/marketing.nav.config";
import { SupportChatLauncher } from "@/components/support/CustomerSupportChat";
import Footer from "./Footer";
import FloatingCTA from "./FloatingCTA";

const APP_NAME = "LeadSmart AI";

const marketingSidebarFooter = (
  <p className="text-center text-xs leading-relaxed text-gray-500">© {new Date().getFullYear()} LeadSmart AI</p>
);

function MarketingTopChrome() {
  return (
    <Topbar
      appName={APP_NAME}
      sections={leadSmartMarketingNav}
      searchPlaceholder="Search calculators, tools, and pages…"
      leadingExtra={
        <Link
          href="/"
          className="flex min-w-0 shrink-0 items-center rounded-2xl p-1 outline-none transition hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-emerald-500/30"
        >
          <LeadSmartLogo className="h-8 max-w-[min(100%,220px)] w-auto sm:h-9" />
        </Link>
      }
      trailing={
        <div className="flex items-center gap-2">
          <SupportChatLauncher />
          <HeaderAuthActions />
        </div>
      }
    />
  );
}

/**
 * LeadSmart AI — App Router shell:
 * - Marketing / tools: `PremiumSidebar` + `Topbar` (`MobileSidebar` inside top bar) from `@repo/ui`
 * - Dashboard + account settings use `DashboardShell` in `app/dashboard/layout.tsx` and `app/account/layout.tsx`
 */
function isPlatformDashboardPath(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/agent/dashboard") ||
    pathname.startsWith("/loan-broker/") ||
    pathname.startsWith("/support/dashboard") ||
    pathname.startsWith("/admin")
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const isPublicReport = pathname.startsWith("/report/");
  const isMarketingHome = pathname === "/";
  const isAuthShell =
    pathname === "/agent-signup" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/onboarding" ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/auth/");

  if (isPublicReport) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="fixed top-4 right-4 z-50">
          <SupportChatLauncher buttonClassName="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-600 shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/[0.04] transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40" />
        </div>
        <main className="min-h-screen">{children}</main>
      </div>
    );
  }

  if (isMarketingHome) {
    return <div className="min-h-screen bg-white">{children}</div>;
  }

  if (isAuthShell) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="fixed top-4 right-4 z-50">
          <SupportChatLauncher buttonClassName="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-600 shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/[0.04] transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40" />
        </div>
        {children}
      </div>
    );
  }

  /** Full-bleed role dashboards ship their own shell (sidebar + top bar). */
  if (isPlatformDashboardPath(pathname)) {
    return <div className="min-h-screen bg-slate-50 text-slate-900">{children}</div>;
  }

  return (
    <div className="flex min-h-screen min-h-0 w-full min-w-0 flex-col overflow-x-hidden bg-gradient-to-br from-slate-50 via-white to-emerald-50/20 text-slate-900 lg:min-h-screen lg:flex-row lg:items-stretch">
      <PremiumSidebar
        appName={APP_NAME}
        sections={leadSmartMarketingNav}
        workspaceLabel={marketingNavConfig.sidebarTitle ?? "Tools"}
        footer={marketingSidebarFooter}
      />
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
        <MarketingTopChrome />
        <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-8">{children}</main>
        <Footer />
        <FloatingCTA />
      </div>
    </div>
  );
}
