"use client";

import { ReactNode } from "react";
import { PremiumSidebar } from "@repo/ui";
import navConfig, { leadSmartNav } from "@/nav.config";
import TopBar from "@/components/dashboard/TopBar";

const APP_NAME = "LeadSmart AI";

/** Matches PropertyTools AI {@link AppShell} sidebar promo card (slate gradient). */
const sidebarFooter = (
  <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 text-sm leading-snug text-white shadow-lg shadow-slate-900/25 ring-1 ring-white/10">
    <p className="font-medium text-white/95">Grow with AI follow-ups</p>
    <p className="mt-1 text-xs text-white/70">Upgrade for more credits and automation.</p>
  </div>
);

/**
 * Authenticated dashboard: same shell pattern as PropertyTools AI — {@link PremiumSidebar} + {@link Topbar} row.
 */
export default function DashboardShell({
  email,
  children,
}: {
  email: string | null | undefined;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100/70 text-slate-900 md:flex md:min-h-screen md:flex-row">
      <PremiumSidebar
        appName={APP_NAME}
        sections={leadSmartNav}
        defaultCollapsed
        workspaceLabel={navConfig.sidebarTitle ?? "Workspace"}
        footerCollapsedLabel="Upgrade & credits"
        footer={sidebarFooter}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TopBar email={email} />
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
