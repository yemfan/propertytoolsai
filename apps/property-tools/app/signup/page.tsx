"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function formatUsPhone(input: string) {
    const digits = input.replace(/\D/g, "").slice(0, 10);
    if (!digits) return "";
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  function isValidUsPhone(input: string) {
    const digits = input.replace(/\D/g, "");
    return digits.length === 10;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!fullName.trim()) return setError("Name is required.");
    if (!email.trim()) return setError("Email is required.");
    if (phone.trim() && !isValidUsPhone(phone)) {
      return setError("Phone must be a valid US number (10 digits) if provided.");
    }
    if (!password.trim() || password.length < 6) {
      return setError("Password must be at least 6 characters.");
    }

    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      });

      if (signUpErr) throw signUpErr;
      const userId = data?.user?.id;
      if (!userId) {
        // Some Supabase configs require email confirmation; session might not exist yet.
        setSuccess("Check your email to confirm your account, then come back to log in.");
        return;
      }

      // Create landing-page profile row for role detection.
      const { error: upsertErr1 } = await supabase.from("user_profiles").upsert(
        {
          user_id: userId,
          role: "user",
          full_name: fullName.trim(),
          phone: phone.trim() ? phone.trim() : null,
        },
        { onConflict: "user_id" }
      );

      if (upsertErr1) {
        const msg = String(upsertErr1?.message ?? "");
        const missingUserId = /user_id.*does not exist|column\s+.*user_id.*does not exist/i.test(
          msg
        );

        if (missingUserId) {
          // no-op for backwards compatibility: `user_profiles` always uses `user_id`
        } else {
          throw upsertErr1;
        }
      }

      router.push("/");
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (/rate limit|too many requests/i.test(msg)) {
        setError(
          "Too many emails sent from this app. Wait an hour or use a different email. In Supabase: Auth → turn off “Confirm email” for dev, or add custom SMTP for production."
        );
      } else if (/confirmation email|confirm email/i.test(msg)) {
        setError(
          "Supabase couldn’t send the confirmation email. For local testing, disable email confirmations in Supabase Dashboard (Authentication → Email/Providers → turn off Confirm email). If you want emails, check Supabase SMTP/Resend settings and that the sender domain is verified."
        );
      } else {
        setError(msg || "Signup failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-5">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-bold text-gray-900">Create your account</h1>
          <p className="text-xs text-gray-600">Get started on the main site. Agents unlock portal features.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">Phone</label>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(formatUsPhone(e.target.value))}
              placeholder="(Optional) Get instant alerts via SMS"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {error ? (
            <p className="text-[11px] text-red-600 font-medium whitespace-pre-line">{error}</p>
          ) : null}
          {success ? (
            <p className="text-[11px] text-emerald-700 font-medium whitespace-pre-line">{success}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center rounded-lg bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <p className="text-[11px] text-gray-500 text-center">
          Already have an account? <a className="text-blue-700 font-semibold" href="/login">Log in</a>
        </p>
      </div>
    </div>
  );
}

