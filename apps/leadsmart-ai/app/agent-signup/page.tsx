"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";

function AgentSignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [brokerage, setBrokerage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const e = searchParams.get("email");
    const n = searchParams.get("fullName");
    if (e) setEmail((prev) => prev || decodeURIComponent(e));
    if (n) setFullName((prev) => prev || decodeURIComponent(n));
  }, [searchParams]);

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
    if (!phone.trim()) return setError("Phone is required for agent onboarding.");
    if (!isValidUsPhone(phone)) {
      return setError("Phone must be a valid US number (10 digits).");
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
        setSuccess("Check your email to confirm your account, then log in to access the dashboard.");
        return;
      }

      // 1) Set role for landing-page detection.
      const { error: upsertUserErr1 } = await supabase.from("user_profiles").upsert(
        {
          user_id: userId,
          role: "agent",
          full_name: fullName.trim(),
          phone: phone.trim(),
          license_number: licenseNumber.trim() || null,
          brokerage: brokerage.trim() || null,
        },
        { onConflict: "user_id" }
      );
      if (upsertUserErr1) {
        const msg = String(upsertUserErr1?.message ?? "");
        const missingUserId = /user_id.*does not exist|column\s+.*user_id.*does not exist/i.test(
          msg
        );

        if (missingUserId) {
          // no-op for backwards compatibility: `user_profiles` always uses `user_id`
        } else {
          throw upsertUserErr1;
        }
      }

      // 2) Create agent row so `/dashboard` can resolve agentId.
      // Keep inserts limited to known columns (auth_user_id + plan_type).
      const { error: upsertAgentErr } = await supabase.from("agents").upsert(
        {
          auth_user_id: userId,
          plan_type: "free",
        } as any,
        { onConflict: "auth_user_id" }
      );
      if (upsertAgentErr) throw upsertAgentErr;

      router.push("/dashboard");
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (/rate limit|too many requests/i.test(msg)) {
        setError(
          "Too many emails sent. Wait before retrying, or in Supabase Dashboard → Authentication → Providers → Email: disable “Confirm email” while testing, or connect custom SMTP."
        );
      } else if (/confirmation email|confirm email/i.test(msg)) {
        setError(
          "Supabase couldn’t send the confirmation email. For local testing, disable email confirmations in Supabase Dashboard (Authentication → Email/Providers → turn off Confirm email). If you want emails, check Supabase SMTP/Resend settings and that the sender domain is verified."
        );
      } else {
        setError(msg || "Agent signup failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-5">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-bold text-gray-900">Start Free as Agent</h1>
          <p className="text-xs text-gray-600">Get access to the agent portal and CMA tools.</p>
          <p className="pt-2 text-[11px] text-gray-500">
            Prefer a 2-minute interactive preview first?{" "}
            <Link href="/onboarding" className="font-semibold text-blue-700 hover:underline">
              Guided onboarding
            </Link>
          </p>
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
            <label className="block text-xs font-medium text-gray-700">Phone</label>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(formatUsPhone(e.target.value))}
              placeholder="(Required) Agent alerts + follow-ups"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">License number (optional)</label>
            <input
              type="text"
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">Brokerage (optional)</label>
            <input
              type="text"
              value={brokerage}
              onChange={(e) => setBrokerage(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="w-full inline-flex items-center justify-center bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Creating agent..." : "Create Agent Account"}
          </button>
        </form>

        <p className="text-[11px] text-gray-500 text-center">
          Prefer regular user signup?{" "}
          <a className="text-blue-700 font-semibold" href="/signup">
            Sign up here
          </a>
        </p>
      </div>
    </div>
  );
}

export default function AgentSignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-gray-500">
          Loading…
        </div>
      }
    >
      <AgentSignupForm />
    </Suspense>
  );
}

