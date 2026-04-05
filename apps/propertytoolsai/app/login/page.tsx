"use client";

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeInternalRedirect } from "@/lib/loginUrl";
import { getOAuthRedirectOrigin } from "@/lib/siteUrl";

// Note: Metadata is not available in client components. Use layout.tsx instead.

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const nextParam = searchParams?.get("next");
  const redirectParam = searchParams?.get("redirect");
  const reason = searchParams?.get("reason");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleOAuth(provider: "google" | "apple") {
    try {
      setLoading(true);
      setError("");
      const target = nextParam ?? redirectParam;
      const safe = target ? safeInternalRedirect(target) : "/dashboard";
      const origin = getOAuthRedirectOrigin();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safe)}&provider=${provider}`,
        },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start social sign in");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) throw signInError;

      if (!data.user?.email_confirmed_at) {
        await supabase.auth.signOut();
        throw new Error("Please verify your email before logging in.");
      }

      const target = nextParam ?? redirectParam;
      const safe = target ? safeInternalRedirect(target) : null;
      window.location.href = safe ?? "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-3xl border bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Welcome Back</h1>
        <p className="mt-2 text-sm text-gray-500">Log in to access your dashboard</p>

        {reason === "trial" ? (
          <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
            Sign in to continue. Next, we will open secure Stripe checkout for your Pro free trial.
          </div>
        ) : null}
        {reason === "checkout" ? (
          <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
            Sign in to continue to checkout. We will return you to pricing right after.
          </div>
        ) : null}
        {reason === "password_reset" ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Your password was updated. Sign in with your new password.
          </div>
        ) : null}
        {reason === "missing_profile" ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            We could not load your saved profile. Use <strong>Continue with Google</strong> or{" "}
            <strong>Continue with Apple</strong> once more to finish setup, or contact support if this message
            persists.
          </div>
        ) : null}
        {searchParams?.get("error") === "oauth" ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {searchParams?.get("provider") === "apple" ? "Apple" : "Google"} sign-in could not be completed. This can happen if the sign-in window was open
            too long or was opened in a different browser tab. Please try again.
          </div>
        ) : null}

        <form onSubmit={handleLogin} className="mt-8 space-y-4">
          <div className="space-y-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleOAuth("google")}
              className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Continue with Google
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleOAuth("apple")}
              className="w-full rounded-2xl bg-[#0072ce] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#0062b5] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Continue with Apple
            </button>
          </div>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-gray-400"
            placeholder="Email"
            autoComplete="email"
          />
          <div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-gray-400"
              placeholder="Password"
              autoComplete="current-password"
            />
            <div className="mt-2 flex justify-end">
              <Link href="/forgot-password" className="text-sm font-medium text-gray-900 underline">
                Forgot password?
              </Link>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          Do not have an account?{" "}
          <Link href="/signup" className="font-medium text-gray-900 underline">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
