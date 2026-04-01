"use client";

import { ReactNode, useMemo } from "react";
import { cn } from "@/lib/utils";
import { PremiumSidebar, filterNavSectionsByRole } from "@repo/ui";
import navConfig, { leadSmartNav } from "@/nav.config";
import TopBar from "@/components/dashboard/TopBar";
import { isAgentOrBrokerProfileRole } from "@/lib/rolePortalPaths";

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
export default function AppDashboardShell({
  email,
  appRole,
  children,
}: {
  email: string | null | undefined;
  /** `user_profiles.role` — used to show admin-only nav (e.g. Platform Overview). */
  appRole?: string | null;
  children: ReactNode;
}) {
  const navSections = useMemo(
    () => filterNavSectionsByRole(leadSmartNav, appRole),
    [appRole]
  );

  const showAgentBrokerPromotion = isAgentOrBrokerProfileRole(appRole);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100/70 text-slate-900 md:flex md:min-h-screen md:flex-row">
      <PremiumSidebar
        appName={APP_NAME}
        sections={navSections}
        workspaceLabel={navConfig.sidebarTitle ?? "Workspace"}
        footer={showAgentBrokerPromotion ? sidebarFooter : undefined}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TopBar email={email} appRole={appRole} />
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}

export type DashboardShellProps = {
  title: string;
  subtitle: string;
  kpis: ReactNode;
  children: ReactNode;
  /** Override KPI grid when you need 6 columns (e.g. admin platform overview). */
  kpiGridClassName?: string;
  className?: string;
};

export function DashboardShell({
  title,
  subtitle,
  kpis,
  children,
  kpiGridClassName,
  className,
}: DashboardShellProps) {
  return (
    <div className={cn("min-h-screen bg-gradient-to-b from-slate-50 to-gray-100 p-4 md:p-6", className)}>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="border-b border-gray-200/80 pb-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">Admin</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        </div>

        <div className={cn("grid gap-4 md:grid-cols-3 xl:grid-cols-5", kpiGridClassName)}>{kpis}</div>

        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
}

