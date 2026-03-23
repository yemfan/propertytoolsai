"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Supabase password recovery landing. Add `/reset-password` to Auth → Redirect URLs.
 */
export default function ResetPasswordPage() {
  const supabase = useMemo(() => createClient(), []);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
        setCheckingLink(false);
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
      }
      setCheckingLink(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const { error: updateErr } = await supabase.auth.updateUser({
        password,
      });

      if (updateErr) throw updateErr;

      setSuccess("Password updated successfully. You can now continue.");
      setPassword("");
      setConfirmPassword("");

      window.setTimeout(() => {
        window.location.href = "/dashboard-router";
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-3xl border bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Reset Password</h1>
          <p className="mt-2 text-sm text-gray-500">Choose a new password for your account.</p>
        </div>

        {checkingLink ? (
          <div className="rounded-2xl border bg-gray-50 px-4 py-3 text-sm text-gray-600">
            Validating recovery link...
          </div>
        ) : !ready ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              This password reset link is invalid or expired.
            </div>
            <Link
              href="/forgot-password"
              className="block rounded-2xl bg-gray-900 px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-gray-800"
            >
              Request a New Reset Link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">New Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-gray-400"
                placeholder="Enter new password"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Confirm Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-gray-400"
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}

            {success ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {success}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-sm text-gray-500">
          <Link href="/login" className="font-medium text-gray-900 underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
