"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AcceptInvitePage() {
  const supabase = useMemo(() => createClient(), []);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [roleLabel, setRoleLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();

      if (data.session?.user) {
        setReady(true);
        const invitedRole = data.session.user.user_metadata?.invited_role;
        setRoleLabel(typeof invitedRole === "string" ? invitedRole : "");
        return;
      }

      setError("Invite link is invalid or expired. Please request a new invitation.");
    }

    void init();
  }, [supabase]);

  async function handleAccept(e: React.FormEvent) {
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

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setSuccess("Your account is ready.");
      setTimeout(() => {
        window.location.href = "/dashboard-router";
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete invite");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-3xl border bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Accept Invitation
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          {roleLabel
            ? `You've been invited as ${roleLabel.replace("_", " ")}.`
            : "Complete your account setup below."}
        </p>

        {!ready ? (
          <div className="mt-8 rounded-2xl border bg-gray-50 px-4 py-3 text-sm text-gray-600">
            {error || "Validating invite link..."}
          </div>
        ) : (
          <form onSubmit={handleAccept} className="mt-8 space-y-4">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border px-4 py-3 text-sm"
              placeholder="Create password"
            />
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-2xl border px-4 py-3 text-sm"
              placeholder="Confirm password"
            />

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-medium text-white disabled:bg-gray-300"
            >
              {loading ? "Saving..." : "Complete Setup"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
