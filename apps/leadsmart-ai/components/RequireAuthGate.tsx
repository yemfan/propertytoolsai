"use client";

import { useEffect, useState } from "react";
import AuthModal from "@/components/AuthModal";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function RequireAuthGate({
  children,
  initialMode = "login",
}: {
  children: React.ReactNode;
  initialMode?: "login" | "signup";
}) {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setChecking(true);
      try {
        const supabase = supabaseBrowser();
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        const hasUser = !!data?.user;
        setAuthed(hasUser);
        setOpen(!hasUser);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
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
      />

      {checking ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[101] text-xs font-semibold bg-white border border-slate-200 rounded-full px-3 py-2 shadow-sm">
          Checking session…
        </div>
      ) : null}
    </>
  );
}

