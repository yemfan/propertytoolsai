"use client";

import { ReactNode } from "react";
import { PremiumSidebar } from "@repo/ui";
import navConfig, { leadSmartNav } from "@/nav.config";
import TopBar from "@/components/dashboard/TopBar";

const APP_NAME = "LeadSmart AI";

const sidebarFooter = (
  <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 p-4 text-sm text-white shadow-sm">
    3 hot leads need follow-up now.
  </div>
);

/**
 * Authenticated dashboard: {@link PremiumSidebar} (md+) + {@link MobileSidebar} inside {@link TopBar}.
 */
export default function DashboardShell({
  email,
  children,
}: {
  email: string | null | undefined;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 md:flex md:min-h-screen md:flex-row">
      <PremiumSidebar
        appName={APP_NAME}
        sections={leadSmartNav}
        defaultCollapsed
        workspaceLabel={navConfig.sidebarTitle ?? "Workspace"}
        footerCollapsedLabel="Hot leads"
        footer={sidebarFooter}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TopBar email={email} />
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
