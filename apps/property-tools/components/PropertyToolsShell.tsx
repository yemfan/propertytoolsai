"use client";

import type { ReactNode } from "react";
import { PremiumSidebar, PremiumTopbar } from "@repo/ui";
import navConfig, { propertyToolsNav } from "@/nav.config";

const APP_NAME = "PropertyTools AI";

/**
 * PropertyToolsAI layout using {@link PremiumSidebar} + {@link PremiumTopbar} from `@repo/ui`.
 * For production chrome with search, tiers, and `AccountMenu`, use `AppShell` instead.
 */
export default function PropertyToolsShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
      <div className="shrink-0">
        <PremiumTopbar
          appName={APP_NAME}
          sections={propertyToolsNav}
          searchPlaceholder="Search address, city, zip..."
          rightActions={[
            { label: "Login", href: "/login", variant: "ghost" },
            { label: "Sign Up", href: "/signup", variant: "outline" },
            { label: "Unlock Premium", href: "/pricing" },
          ]}
          profileVariant="chip"
          profileHref="/login"
          profileName="Guest User"
          profileEmail="Sign in to save results"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <PremiumSidebar
          appName={APP_NAME}
          sections={propertyToolsNav}
          defaultCollapsed
          workspaceLabel={navConfig.sidebarTitle ?? "Tools"}
          branding="none"
          height="stretch"
        />
        <main className="min-h-0 min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
