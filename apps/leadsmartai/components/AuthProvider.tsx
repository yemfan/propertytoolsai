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
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import AuthModal from "@/components/AuthModal";

import type { SignupOverlayPrefill } from "@/lib/hooks/useSignupProfilePrefill";
import AgentSignupModal from "@/components/AgentSignupModal";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  openAuth: (mode?: "login" | "signup") => void;
  closeAuth: () => void;
  /** Modeless agent signup panel (same app shell as login modal). */
  openAgentSignup: (prefill?: SignupOverlayPrefill) => void;
  closeAgentSignup: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [agentSignupOpen, setAgentSignupOpen] = useState(false);
  const [agentSignupPrefill, setAgentSignupPrefill] = useState<SignupOverlayPrefill | null>(null);

  const refresh = useCallback(async () => {
    const supabase = supabaseBrowser();
    const {
      data: { user: next },
    } = await supabase.auth.getUser();
    setUser(next ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refresh();
      if (!cancelled) setLoading(false);
    })();

    const supabase = supabaseBrowser();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      refresh,
      openAuth: (mode = "login") => {
        setAuthMode(mode);
        setAuthOpen(true);
      },
      closeAuth: () => setAuthOpen(false),
      openAgentSignup: (prefill) => {
        setAgentSignupPrefill(prefill ?? null);
        setAgentSignupOpen(true);
      },
      closeAgentSignup: () => {
        setAgentSignupOpen(false);
        setAgentSignupPrefill(null);
      },
    }),
    [user, loading, refresh]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthModal
        open={authOpen}
        initialMode={authMode}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={() => void refresh()}
      />
      <AgentSignupModal
        open={agentSignupOpen}
        overlayPrefill={agentSignupPrefill}
        onClose={() => {
          setAgentSignupOpen(false);
          setAgentSignupPrefill(null);
        }}
      />
    </AuthContext.Provider>
  );
}
