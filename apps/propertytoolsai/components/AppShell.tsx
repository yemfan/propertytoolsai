"use client";

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { PremiumSidebar, Topbar, type NavSection } from "@repo/ui";
import AuthProvider, { useAuth } from "@/components/AuthProvider";
import { AccessProvider, useAccess } from "@/components/AccessProvider";
import AccountMenu from "@/components/layout/AccountMenu";
import { hasPremiumToolAccess } from "@/lib/access";
import { getNavSectionsForRole } from "@/lib/auth/navByRole";
import { parseUserRole, type UserRole } from "@/lib/auth/roles";
import { stripUnlockPremiumNavItem } from "@/lib/nav/stripUnlockPremiumNav";
import AssignedAgentCard from "@/components/assigned-agent/AssignedAgentCard";
import AgentChatWidget from "@/components/assigned-agent/AgentChatWidget";
import PropertyToolsLogo from "@/components/brand/PropertyToolsLogo";
import MarketingTopNav from "@/components/marketing/MarketingTopNav";
import { propertyToolsNav } from "@/nav.config";

const APP_NAME = "PropertyTools AI";

/**
 * Paths that belong to the logged-in product surface. Visiting any of these
 * always gets the full {@link PremiumSidebar} + {@link Topbar} chrome, even
 * if the user somehow arrives unauthenticated (they'll be bounced by the
 * page-level auth guard). Everything else is treated as a marketing surface:
 * homepage, pricing, tool landing pages, blog, about, contact, legal, etc.
 */
const APP_CHROME_PREFIXES = [
  "/dashboard",
  "/agent",
  "/admin",
  "/account",
  "/portal",
  "/loan-broker",
  "/match",
  "/smart-cma-builder",
  "/ai-cma-analyzer",
  "/listing",
  "/presentation",
  "/billing",
  "/invite",
  "/checkout-success",
  "/content",
];

function isAppChromePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return APP_CHROME_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

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
      leadingExtra={
        <Link
          href="/"
          className="flex min-w-0 items-center rounded-2xl py-1 outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#0072ce]/35"
        >
          <PropertyToolsLogo className="max-w-[min(180px,55vw)] text-lg sm:max-w-[220px] sm:text-xl" />
        </Link>
      }
      searchSlot={null}
      rightActions={
        authLoading
          ? []
          : isLoggedOut
            ? [
                { label: "Login", onClick: () => openAuth("login"), variant: "ghost" as const },
                { label: "Sign Up Free", onClick: () => openAuth("signup"), variant: "outline" as const },
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
    />
  );
}

/**
 * PropertyToolsAI chrome: full-width {@link Topbar} first, then {@link PremiumSidebar} (lg+) + main; {@link MobileSidebar} is inside the top bar below lg.
 * Repo path: `apps/propertytoolsai`. Nav: {@link propertyToolsNav} from `nav.config.tsx`.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

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
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const [rbacRole, setRbacRole] = useState<UserRole>("consumer");

  useEffect(() => {
    if (!user) {
      setRbacRole("consumer");
      return;
    }
    let cancelled = false;
    void fetch("/api/auth/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.role) return;
        setRbacRole(parseUserRole(String(data.role)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  const { usage } = useAccess();
  const hideUnlockPremium = Boolean(
    usage?.userId && hasPremiumToolAccess({ tier: usage.tier, plan: usage.plan })
  );
  const navSections = useMemo(() => {
    const base = user ? getNavSectionsForRole(rbacRole) : propertyToolsNav;
    return hideUnlockPremium ? stripUnlockPremiumNavItem(base) : base;
  }, [hideUnlockPremium, rbacRole, user]);

  /**
   * Route unauthenticated visitors on public marketing pages through the
   * lightweight {@link MarketingTopNav} instead of the full product chrome
   * (272px sidebar + top bar). Once auth is resolved and the user is
   * logged in — or the path is a known app-chrome prefix — we fall through
   * to the normal authed layout below.
   *
   * While `authLoading` is true we default to the marketing shell on
   * marketing paths so the first paint doesn't flash a sidebar that will
   * disappear a moment later.
   *
   * NOTE: all hooks above MUST run before this branching point. Do not add
   * an early `return` above this line — it would violate the Rules of Hooks.
   */
  const onAppPath = isAppChromePath(pathname);
  const isMarketingVisitor = !onAppPath && (authLoading || !user);
  if (isMarketingVisitor) {
    return (
      <div className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <MarketingTopNav />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100/70 text-slate-900">
      {/* Left: sidebar spans full height — agent card on top, nav below */}
      <PremiumSidebar
        appName={APP_NAME}
        sections={navSections}
        branding="none"
        height="stretch"
        topSlot={<AssignedAgentCard />}
      />
      {/* Right: header (logo + menu) then page content */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <div className="shrink-0">
          <PropertyToolsTopChrome navSections={navSections} hideUnlockPremium={hideUnlockPremium} />
        </div>
        <main className="min-h-0 min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
      <AgentChatWidget customerUserId={user?.id ?? null} />
    </div>
  );
}
