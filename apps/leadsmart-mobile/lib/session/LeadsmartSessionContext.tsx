import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchMobileLeads } from "../leadsmartMobileApi";
import { readOnboardingComplete, writeOnboardingComplete } from "./onboardingFlag";
import { clearStoredAccessToken, readStoredAccessToken, writeStoredAccessToken } from "./secureToken";
import { clearCachedAccessToken, setCachedAccessToken } from "./tokenCache";

type LeadsmartSessionValue = {
  ready: boolean;
  accessToken: string | null;
  onboardingComplete: boolean;
  /** Persist JWT after validating against the mobile API. */
  signInWithToken: (token: string) => Promise<void>;
  /** Clear stored token (keeps onboarding flag). */
  signOut: () => Promise<void>;
  /** Call after the notification step (or skip). */
  markOnboardingComplete: () => Promise<void>;
};

const LeadsmartSessionContext = createContext<LeadsmartSessionValue | null>(null);

export function LeadsmartSessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [stored, onboarded] = await Promise.all([
          readStoredAccessToken(),
          readOnboardingComplete(),
        ]);
        if (cancelled) return;
        const t = stored?.trim() ?? "";
        if (t) setCachedAccessToken(t);
        else clearCachedAccessToken();
        setAccessToken(t || null);
        setOnboardingComplete(onboarded);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signInWithToken = useCallback(async (token: string) => {
    const t = token.trim();
    if (!t) throw new Error("Paste your access token from LeadSmart.");

    setCachedAccessToken(t);
    const res = await fetchMobileLeads({ page: 1, pageSize: 1 });
    if (res.ok === false) {
      clearCachedAccessToken();
      throw new Error(res.message);
    }

    await writeStoredAccessToken(t);
    setAccessToken(t);
  }, []);

  const signOut = useCallback(async () => {
    clearCachedAccessToken();
    await clearStoredAccessToken();
    setAccessToken(null);
  }, []);

  const markOnboardingComplete = useCallback(async () => {
    await writeOnboardingComplete(true);
    setOnboardingComplete(true);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      accessToken,
      onboardingComplete,
      signInWithToken,
      signOut,
      markOnboardingComplete,
    }),
    [ready, accessToken, onboardingComplete, signInWithToken, signOut, markOnboardingComplete]
  );

  return <LeadsmartSessionContext.Provider value={value}>{children}</LeadsmartSessionContext.Provider>;
}

export function useLeadsmartSession(): LeadsmartSessionValue {
  const ctx = useContext(LeadsmartSessionContext);
  if (!ctx) {
    throw new Error("useLeadsmartSession must be used within LeadsmartSessionProvider");
  }
  return ctx;
}
