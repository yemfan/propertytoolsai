"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode, useMemo } from "react";
import { usePathname } from "next/navigation";
import { PremiumSidebar, Topbar, type NavSection } from "@repo/ui";
import AuthProvider, { useAuth } from "@/components/AuthProvider";
import { AccessProvider, useAccess } from "@/components/AccessProvider";
import AccountMenu from "@/components/layout/AccountMenu";
import GlobalSearchBar from "@/components/layout/GlobalSearchBar";
import { hasPremiumToolAccess } from "@/lib/access";
import { stripUnlockPremiumNavItem } from "@/lib/nav/stripUnlockPremiumNav";
import navConfig, { propertyToolsNav } from "@/nav.config";

const APP_NAME = "PropertyTools AI";

function PropertyToolsTopChrome({
  navSections,
  hideUnlockPremium,
}: {
  navSections: NavSection[];
  hideUnlockPremium: boolean;
}) {
  const { user, loading: authLoading, openAuth } = useAuth();
  const { openPaywall } = useAccess();
  const isLoggedOut = !user;

  return (
    <Topbar
      appName={APP_NAME}
      sections={navSections}
      searchPlaceholder="Search address, city, zip..."
      leadingExtra={
        <Link
          href="/"
          className="flex min-w-0 shrink-0 items-center gap-2 rounded-2xl p-1 outline-none transition hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-[#0072ce]/35"
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
        authLoading
          ? []
          : isLoggedOut
            ? [
                { label: "Login", onClick: () => openAuth("login"), variant: "ghost" as const },
                { label: "Sign Up", onClick: () => openAuth("signup"), variant: "outline" as const },
                { label: "Unlock Premium", onClick: () => openPaywall() },
              ]
            : []
      }
      trailing={
        authLoading ? (
          <div className="h-9 w-28 animate-pulse rounded-xl bg-slate-100 sm:w-36" aria-hidden />
        ) : isLoggedOut ? null : (
          <>
            {hideUnlockPremium ? (
              <span className="hidden rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1.5 text-[11px] font-semibold text-emerald-900 shadow-sm sm:inline">
                Premium
              </span>
            ) : (
              <button
                type="button"
                onClick={() => openPaywall()}
                className="inline-flex h-10 items-center justify-center rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 text-xs font-semibold text-white shadow-md shadow-amber-500/20 transition hover:from-amber-600 hover:to-orange-600 sm:text-sm"
              >
                Unlock Premium
              </button>
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
 * PropertyToolsAI chrome: full-width {@link Topbar} first, then {@link PremiumSidebar} (md+) + main; {@link MobileSidebar} is inside the top bar.
 * Repo path: `apps/property-tools`. Nav: {@link propertyToolsNav} from `nav.config.tsx`.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isMarketingHome = pathname === "/";

  if (isMarketingHome) {
    return (
      <AuthProvider>
        <AccessProvider>
          <div className="min-h-screen bg-white text-slate-900">{children}</div>
        </AccessProvider>
      </AuthProvider>
    );
  }

  /** Full-bleed design preview (`app/layout-preview`) — avoids double sidebar/topbar. */
  if (pathname === "/layout-preview") {
    return (
      <AuthProvider>
        <AccessProvider>
          <div className="min-h-screen">{children}</div>
        </AccessProvider>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <AccessProvider>
        <AppShellAuthedLayout>{children}</AppShellAuthedLayout>
      </AccessProvider>
    </AuthProvider>
  );
}

/** Uses {@link useAccess} — must render inside {@link AccessProvider}. */
function AppShellAuthedLayout({ children }: { children: ReactNode }) {
  const { usage } = useAccess();
  const hideUnlockPremium = Boolean(
    usage?.userId && hasPremiumToolAccess({ tier: usage.tier, plan: usage.plan })
  );
  const navSections = useMemo(
    () => (hideUnlockPremium ? stripUnlockPremiumNavItem(propertyToolsNav) : propertyToolsNav),
    [hideUnlockPremium]
  );

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100/70 text-slate-900">
      <div className="shrink-0">
        <PropertyToolsTopChrome navSections={navSections} hideUnlockPremium={hideUnlockPremium} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <PremiumSidebar
          appName={APP_NAME}
          sections={navSections}
          defaultCollapsed
          workspaceLabel={navConfig.sidebarTitle ?? "Tools"}
          branding="none"
          height="stretch"
        />
        <main className="min-h-0 min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
