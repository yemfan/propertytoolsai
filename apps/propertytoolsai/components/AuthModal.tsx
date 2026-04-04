"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { safeInternalRedirect } from "@/lib/loginUrl";
import { getOAuthRedirectOrigin } from "@/lib/siteUrl";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Mode = "login" | "signup";

export default function AuthModal(props: {
  open: boolean;
  onClose: () => void;
  /** Called after successful login or signup (when session exists). */
  onAuthenticated?: () => void;
  initialMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(props.initialMode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (props.open) {
      setMode(props.initialMode ?? "login");
      setError(null);
      setInfo(null);
      setPhone("");
    }
  }, [props.open, props.initialMode]);

  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, loading, props.onClose]);

  if (!props.open) return null;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) {
        setError(err.message);
        return;
      }
      props.onAuthenticated?.();
      props.onClose();
    } catch (e: any) {
      setError(e?.message ?? "Sign in failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim() || !password || password.length < 6) {
      setError("Valid email and password (6+ chars) are required.");
      return;
    }
    const p = phone.trim();
    if (p) {
      const digits = p.replace(/\D/g, "");
      if (digits.length < 10) {
        setError("If you add a phone number, use at least 10 digits.");
        return;
      }
    }
    const phoneForProfile = p || null;
    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim() || undefined,
            phone: phoneForProfile ?? undefined,
          },
        },
      });
      if (err) {
        setError(err.message);
        return;
      }
      const userId = data?.user?.id;
      if (userId) {
        const { error: upErr } = await supabase.from("user_profiles").upsert(
          {
            user_id: userId,
            email: email.trim(),
            full_name: fullName.trim() || null,
            phone: phoneForProfile,
          },
          { onConflict: "user_id" }
        );
        if (upErr) console.error(upErr.message);
        const { error: lsErr } = await supabase.from("leadsmart_users").upsert(
          { user_id: userId, role: "user" },
          { onConflict: "user_id" }
        );
        if (lsErr) console.error(lsErr.message);
        const { error: ptErr } = await supabase.from("propertytools_users").upsert(
          { user_id: userId, tier: "basic" },
          { onConflict: "user_id" }
        );
        if (ptErr) console.error(ptErr.message);
        props.onAuthenticated?.();
        props.onClose();
      } else {
        setInfo("Check your email to confirm your account, then sign in.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Sign up failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "apple") {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      const origin = getOAuthRedirectOrigin();
      const rawNext = `${window.location.pathname}${window.location.search || ""}`;
      const next = safeInternalRedirect(rawNext) ?? "/dashboard";
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (err) {
        setError(err.message);
      }
    } catch (e: any) {
      setError(e?.message ?? "OAuth sign in failed.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-3 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-pointer border-0 bg-transparent p-0"
        aria-label="Close dialog"
        onClick={() => !loading && props.onClose()}
      />
      <div
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {mode === "login" ? "Sign in" : "Create account"}
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                {mode === "login"
                  ? "Use your email to access saved work and higher limits."
                  : "Free account — unlock more tool runs and sync across devices."}
              </p>
            </div>
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => !loading && props.onClose()}
            >
              Close
            </button>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                mode === "login"
                  ? "border-slate-300 bg-white text-slate-900 shadow-sm"
                  : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-white"
              }`}
              onClick={() => {
                setMode("login");
                setError(null);
                setInfo(null);
              }}
            >
              Log in
            </button>
            <button
              type="button"
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                mode === "signup"
                  ? "border-slate-300 bg-white text-slate-900 shadow-sm"
                  : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-white"
              }`}
              onClick={() => {
                setMode("signup");
                setError(null);
                setInfo(null);
              }}
            >
              Sign up
            </button>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="space-y-2 pb-4">
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleOAuth("google")}
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Continue with Google
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleOAuth("apple")}
              className="inline-flex w-full items-center justify-center rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Continue with Apple
            </button>
          </div>
          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  autoComplete="current-password"
                  required
                />
              </div>
              {error ? (
                <p className="text-xs font-medium text-red-600 whitespace-pre-line">{error}</p>
              ) : null}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Phone number <span className="font-normal text-slate-500">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  autoComplete="tel"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
              </div>
              {error ? (
                <p className="text-xs font-medium text-red-600 whitespace-pre-line">{error}</p>
              ) : null}
              {info ? (
                <p className="text-xs font-medium text-emerald-700 whitespace-pre-line">{info}</p>
              ) : null}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? "Creating account…" : "Create free account"}
              </button>
            </form>
          )}

          <p className="mt-4 text-center text-[11px] text-slate-500">
            Agent?{" "}
            <Link className="font-semibold text-blue-700 hover:underline" href="/agent-signup">
              Agent signup
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
