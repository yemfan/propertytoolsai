"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PremiumSidebar, Topbar } from "@repo/ui";
import { AccessProvider, useAccess } from "@/components/AccessProvider";
import AccountMenu from "@/components/layout/AccountMenu";
import GlobalSearchBar from "@/components/layout/GlobalSearchBar";
import navConfig, { propertyToolsNav } from "@/nav.config";

const APP_NAME = "PropertyTools AI";

const sidebarFooter = (
  <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-slate-50/80 p-3.5 text-sm leading-snug text-slate-600 shadow-sm">
    Save results and unlock premium AI tools.
  </div>
);

function PropertyToolsTopChrome() {
  const { tier } = useAccess();
  const isGuest = tier === "guest";

  return (
    <Topbar
      appName={APP_NAME}
      sections={propertyToolsNav}
      searchPlaceholder="Search address, city, zip..."
      leadingExtra={
        <Link
          href="/"
          className="flex min-w-0 shrink-0 items-center gap-2 rounded-lg outline-none ring-blue-500/30 focus-visible:ring-2"
        >
          <Image
            src="/images/ptlogo.png"
            alt={APP_NAME}
            width={180}
            height={54}
            className="h-8 w-auto sm:h-9"
            priority
          />
        </Link>
      }
      searchSlot={
        <div className="hidden min-[480px]:block">
          <GlobalSearchBar
            className="max-w-full"
            placeholder="Search address, city, zip..."
          />
        </div>
      }
      rightActions={
        isGuest
          ? [
              { label: "Login", href: "/login", variant: "ghost" as const },
              { label: "Sign Up", href: "/signup", variant: "outline" as const },
              { label: "Unlock Premium", href: "/pricing" },
            ]
          : []
      }
      trailing={
        isGuest ? null : (
          <>
            {tier === "premium" ? (
              <span className="hidden rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 sm:inline">
                Premium
              </span>
            ) : (
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:from-amber-600 hover:to-orange-600 sm:text-sm"
              >
                <span className="hidden sm:inline">Unlock </span>premium
              </Link>
            )}
            <AccountMenu />
          </>
        )
      }
      below={
        <div className="px-3 pb-3 pt-2 min-[480px]:hidden">
          <GlobalSearchBar
            className="max-w-full"
            placeholder="Search address, city, zip..."
          />
        </div>
      }
    />
  );
}

/**
 * PropertyToolsAI chrome: {@link PremiumSidebar} (md+) + {@link MobileSidebar} (inside {@link Topbar}) + {@link Topbar}.
 * Repo path: `apps/property-tools`. Nav: {@link propertyToolsNav} from `nav.config.tsx`.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isMarketingHome = pathname === "/";

  if (isMarketingHome) {
    return (
      <AccessProvider>
        <div className="min-h-screen bg-white text-slate-900">{children}</div>
      </AccessProvider>
    );
  }

  return (
    <AccessProvider>
      <div className="min-h-screen bg-gray-50 text-gray-900 md:flex md:min-h-screen md:flex-row">
        <PremiumSidebar
          appName={APP_NAME}
          sections={propertyToolsNav}
          defaultCollapsed
          workspaceLabel={navConfig.sidebarTitle ?? "Tools"}
          footerCollapsedLabel="Unlock premium tools"
          footer={sidebarFooter}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <PropertyToolsTopChrome />
          <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </AccessProvider>
  );
}
