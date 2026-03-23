"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AccessTier } from "@/lib/access";
import { isPremiumPlan } from "@/lib/access";
import type { AccessUsageState } from "@/lib/usage";
import { getUsage } from "@/lib/usage";
import AuthModal from "@/components/AuthModal";
import PaywallModal from "@/components/PaywallModal";

type AccessContextValue = {
  tier: AccessTier;
  usage: AccessUsageState | null;
  loading: boolean;
  refresh: () => Promise<void>;
  openAuth: (mode?: "login" | "signup") => void;
  closeAuth: () => void;
  openPaywall: (message?: string) => void;
  closePaywall: () => void;
};

const AccessContext = createContext<AccessContextValue | null>(null);

export function useAccess() {
  const ctx = useContext(AccessContext);
  if (!ctx) {
    throw new Error("useAccess must be used within AccessProvider");
  }
  return ctx;
}

export function AccessProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [usage, setUsage] = useState<AccessUsageState | null>(null);
  const usageRef = useRef<AccessUsageState | null>(null);
  usageRef.current = usage;

  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallMessage, setPaywallMessage] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const state = await getUsage();
      setUsage(state);
    } catch {
      setUsage(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const tier: AccessTier = usage?.tier ?? "guest";

  const closePaywall = useCallback(() => {
    setPaywallOpen(false);
    setPaywallMessage(undefined);
  }, []);

  const openPaywall = useCallback((message?: string) => {
    if (isPremiumPlan(usageRef.current?.plan ?? null)) return;
    setPaywallMessage(message);
    setPaywallOpen(true);
  }, []);

  /** Paid Pro/Premium subscribers resolve to `tier === "premium"` — never keep the upgrade modal open. */
  useEffect(() => {
    if (tier === "premium") {
      closePaywall();
    }
  }, [tier, closePaywall]);

  /** After Stripe return (`/?checkout=success`), reload usage and dismiss the dialog. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("checkout") !== "success") return;

    let cancelled = false;
    void (async () => {
      await refresh();
      if (cancelled) return;
      closePaywall();
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      const next = `${url.pathname}${url.search}`;
      router.replace(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, refresh, router, closePaywall]);

  const value = useMemo<AccessContextValue>(
    () => ({
      tier,
      usage,
      loading,
      refresh,
      openAuth: (mode = "login") => {
        setAuthMode(mode);
        setAuthOpen(true);
      },
      closeAuth: () => setAuthOpen(false),
      openPaywall,
      closePaywall,
    }),
    [tier, usage, loading, refresh, openPaywall, closePaywall]
  );

  return (
    <AccessContext.Provider value={value}>
      {children}
      <AuthModal
        open={authOpen}
        initialMode={authMode}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={() => void refresh()}
      />
      <PaywallModal
        open={paywallOpen}
        onClose={closePaywall}
        message={paywallMessage}
        ctaLabel="Upgrade Now"
      />
    </AccessContext.Provider>
  );
}
