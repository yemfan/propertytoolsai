"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function formatUsPhone(input: string) {
  const digits = input.replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function isValidUsPhone(input: string) {
  return input.replace(/\D/g, "").length === 10;
}

export default function SignupPage() {
  const supabase = useMemo(() => createClient(), []);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const nameTrim = fullName.trim();
      const emailTrim = email.trim();
      if (!nameTrim) {
        setError("Full name is required.");
        return;
      }
      if (!emailTrim) {
        setError("Email is required.");
        return;
      }
      if (!phone.trim()) {
        setError("Phone number is required.");
        return;
      }
      if (!isValidUsPhone(phone)) {
        setError("Phone must be a valid US number (10 digits).");
        return;
      }

      const digits = phone.replace(/\D/g, "");
      const e164 = `+1${digits}`;

      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: emailTrim,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: nameTrim,
            phone_e164: e164,
          },
        },
      });

      if (signUpErr) throw signUpErr;

      if (data.user) {
        const uid = data.user.id;

        if (data.session) {
          const { error: updErr } = await supabase.auth.updateUser({
            phone: e164,
            data: { full_name: nameTrim },
          });
          if (updErr) console.error(updErr.message);
        }

        const { error: upErr } = await supabase.from("user_profiles").upsert(
          {
            user_id: uid,
            full_name: nameTrim,
            email: emailTrim,
            phone: e164,
          },
          { onConflict: "user_id" }
        );
        if (upErr) console.error(upErr.message);

        const { error: lsErr } = await supabase.from("leadsmart_users").upsert(
          { user_id: uid, role: "user" },
          { onConflict: "user_id" }
        );
        if (lsErr) console.error(lsErr.message);

        const { error: ptErr } = await supabase.from("propertytools_users").upsert(
          { user_id: uid, tier: "basic" },
          { onConflict: "user_id" }
        );
        if (ptErr) console.error(ptErr.message);
      }

      setSuccess("Account created. Please check your email to verify your account.");
      setFullName("");
      setEmail("");
      setPhone("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign up");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-3xl border bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Create Account</h1>
        <p className="mt-2 text-sm text-gray-500">Sign up and verify your email to continue.</p>

        <form onSubmit={handleSignup} className="mt-8 space-y-4">
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-gray-400"
            placeholder="Full name"
            autoComplete="name"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-gray-400"
            placeholder="Email"
            autoComplete="email"
          />
          <input
            type="tel"
            inputMode="tel"
            required
            value={phone}
            onChange={(e) => setPhone(formatUsPhone(e.target.value))}
            className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-gray-400"
            placeholder="Phone (US, 10 digits)"
            autoComplete="tel"
          />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-gray-400"
            placeholder="Password (min 8 characters)"
            autoComplete="new-password"
          />

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
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-gray-900 underline">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
