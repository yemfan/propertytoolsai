"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Phase = "checking" | "ready" | "no_session" | "success";

/**
 * Supabase recovery landing — same path as Property Tools (`/reset-password`) so one Redirect URL per host works.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let cancelled = false;

    async function hasSession(): Promise<boolean> {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return false;
      if (session?.user) {
        setPhase("ready");
        return true;
      }
      return false;
    }

    void hasSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session?.user) setPhase("ready");
    });

    const failTimer = window.setTimeout(() => {
      void (async () => {
        const ok = await hasSession();
        if (!ok && !cancelled) setPhase("no_session");
      })();
    }, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(failTimer);
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const supabase = supabaseBrowser();
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) {
        setError(updErr.message);
        return;
      }
      setPhase("success");
      router.refresh();
      window.setTimeout(() => {
        router.replace("/dashboard-router");
      }, 1200);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not update password.");
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p className="text-sm text-slate-600">Verifying reset link…</p>
      </div>
    );
  }

  if (phase === "no_session") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4 text-center">
          <h1 className="text-lg font-bold text-gray-900">Link expired or invalid</h1>
          <p className="text-sm text-gray-600">
            Open the latest link from your password reset email, or request a new one from the log in page.
          </p>
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Back to log in
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center text-sm font-medium text-emerald-900">
          Password updated. Redirecting…
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-bold text-gray-900">Set a new password</h1>
          <p className="text-xs text-gray-600">Choose a password you haven&apos;t used here before.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="new-password"
              required
              minLength={6}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="new-password"
              required
              minLength={6}
            />
          </div>
          {error ? <p className="text-[11px] font-medium text-red-600 whitespace-pre-line">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Update password"}
          </button>
        </form>
        <p className="text-center text-[11px] text-gray-500">
          <Link href="/login" className="font-semibold text-blue-700 hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
