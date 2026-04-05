"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SESSION_KEY = "pt_exit_popup_done";
const MOBILE_DELAY_MS = 40_000; // 40s on mobile (no mouse-leave)

function isCoarsePointer() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

export default function ExitIntentPopup() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const shownRef = useRef(false);
  const allowedRef = useRef(false); // gate: only trigger after 4s on page

  // Only allow exit-intent after the visitor has been on the page for a few seconds
  useEffect(() => {
    const t = setTimeout(() => { allowedRef.current = true; }, 4500);
    return () => clearTimeout(t);
  }, []);

  const tryShow = useCallback((source: string) => {
    if (shownRef.current) return;
    try { if (sessionStorage.getItem(SESSION_KEY)) return; } catch { /* ignore */ }
    shownRef.current = true;
    setOpen(true);
    // fire-and-forget analytics
    fetch("/api/marketing/exit-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "open", source, page_path: window.location.pathname }),
    }).catch(() => {});
  }, []);

  // Desktop: mouse leaves viewport through top edge
  useEffect(() => {
    const onLeave = (e: MouseEvent) => {
      if (!allowedRef.current || e.clientY > 0) return;
      tryShow("exit_intent");
    };
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => document.documentElement.removeEventListener("mouseleave", onLeave);
  }, [tryShow]);

  // Mobile: time-based trigger
  useEffect(() => {
    if (!isCoarsePointer()) return;
    const t = setTimeout(() => tryShow("mobile_timer"), MOBILE_DELAY_MS);
    return () => clearTimeout(t);
  }, [tryShow]);

  const dismiss = useCallback(() => {
    setOpen(false);
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ }
  }, []);

  // Escape key closes
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, dismiss]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "loading") return;
    setErrorMsg("");
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMsg("Please enter a valid email.");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/marketing/exit-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          page_path: typeof window !== "undefined" ? window.location.pathname : "/",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setStatus("error");
        setErrorMsg(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setStatus("success");
      try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ }
      setTimeout(() => setOpen(false), 2400);
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Try again.");
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pt-exit-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={dismiss}
      />

      {/* Card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
        {/* Close button */}
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="border-b border-slate-100 bg-gradient-to-br from-[#0072ce]/[0.06] via-white to-slate-50/80 px-6 pb-5 pt-8 sm:px-8">
          <p id="pt-exit-title" className="font-heading text-xl font-bold text-slate-900 sm:text-2xl">
            Before you go — get your free home value report
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Enter your email and we&apos;ll send a detailed breakdown: estimated value range, local comps, and market trend for your area.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-6 sm:px-8">
          {status === "success" ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-center">
              <p className="text-base font-semibold text-emerald-800">You&apos;re all set — check your inbox!</p>
              <p className="mt-1 text-sm text-emerald-700">Your free report is on its way.</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3">
              <label className="block">
                <span className="sr-only">Email address</span>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-[#0072ce] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0072ce]/20"
                />
              </label>
              {errorMsg && <p className="text-sm font-medium text-red-600">{errorMsg}</p>}
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full rounded-xl bg-[#0072ce] px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-900/15 transition hover:bg-[#005ca8] disabled:opacity-70"
              >
                {status === "loading" ? "Sending…" : "Send my free report"}
              </button>
              <p className="text-center text-xs text-slate-400">No spam. Unsubscribe anytime.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
