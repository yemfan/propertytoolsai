"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AccessTier } from "@/lib/access";
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
  const [usage, setUsage] = useState<AccessUsageState | null>(null);
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
      openPaywall: (message) => {
        setPaywallMessage(message);
        setPaywallOpen(true);
      },
      closePaywall: () => setPaywallOpen(false),
    }),
    [tier, usage, loading, refresh]
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
        onClose={() => setPaywallOpen(false)}
        message={paywallMessage}
        ctaLabel="Upgrade Now"
      />
    </AccessContext.Provider>
  );
}
