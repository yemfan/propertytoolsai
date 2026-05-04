"use client";

import { useEffect, useState } from "react";
import AuthModal from "@/components/AuthModal";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

/**
 * Only show the "Checking session…" pill if the auth check takes longer
 * than this threshold. Most cached supabase sessions resolve in <100ms;
 * a 600ms gate avoids the flash + lingering pill TOM flagged in TVR-011
 * (BF-044 — "Checking session… hangs at bottom of tool pages") while
 * still surfacing genuinely-slow checks for the user.
 */
const PILL_VISIBILITY_DELAY_MS = 600;

export default function RequireAuthGate({
  children,
  initialMode = "login",
}: {
  children: React.ReactNode;
  initialMode?: "login" | "signup";
}) {
  const [checking, setChecking] = useState(true);
  const [showPill, setShowPill] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const pillTimer = window.setTimeout(() => {
      if (!cancelled) setShowPill(true);
    }, PILL_VISIBILITY_DELAY_MS);

    (async () => {
      try {
        const supabase = supabaseBrowser();
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        const hasUser = !!data?.user;
        setAuthed(hasUser);
        setOpen(!hasUser);
      } finally {
        if (!cancelled) {
          window.clearTimeout(pillTimer);
          setShowPill(false);
          setChecking(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(pillTimer);
    };
  }, []);

  return (
    <>
      <div className={authed ? "" : "pointer-events-none select-none blur-[1px]"}>
        {children}
      </div>

      <AuthModal
        open={open}
        onClose={() => setOpen(false)}
        initialMode={initialMode}
        onAuthenticated={() => {
          setAuthed(true);
          setOpen(false);
        }}
      />

      {checking && showPill ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[101] text-xs font-semibold bg-white border border-slate-200 rounded-full px-3 py-2 shadow-sm">
          Checking session…
        </div>
      ) : null}
    </>
  );
}

