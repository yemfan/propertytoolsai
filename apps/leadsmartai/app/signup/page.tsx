"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useSignupProfilePrefill, type SignupPrefillConsumer } from "@/lib/hooks/useSignupProfilePrefill";
import { safeInternalRedirect } from "@/lib/loginUrl";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { formatUsPhoneInput, formatUsPhoneStored, isValidUsPhone } from "@/lib/usPhone";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { values: prefill, hasSession, loading: prefillLoading } = useSignupProfilePrefill("consumer");
  const pv = prefill as SignupPrefillConsumer;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (prefillLoading) return;
    setFullName(pv.fullName);
    setEmail(pv.email);
    setPhone(pv.phone ? formatUsPhoneInput(pv.phone) : "");
  }, [prefillLoading, pv]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!fullName.trim()) return setError("Name is required.");
    if (!email.trim()) return setError("Email is required.");
    if (phone.trim() && !isValidUsPhone(phone)) {
      return setError("Phone must be a valid US number (10 digits) if provided.");
    }

    if (hasSession) {
      setLoading(true);
      try {
        const supabase = supabaseBrowser();
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!user) throw new Error("Session expired. Please log in again.");

        const phoneVal = phone.trim() ? formatUsPhoneStored(phone) : null;
        const { error: upProfErr } = await supabase.from("user_profiles").upsert(
          {
            user_id: user.id,
            full_name: fullName.trim(),
            phone: phoneVal,
          },
          { onConflict: "user_id" }
        );
        if (upProfErr) {
          const msg = String(upProfErr?.message ?? "");
          const missingUserId = /user_id.*does not exist|column\s+.*user_id.*does not exist/i.test(msg);
          if (!missingUserId) throw upProfErr;
        }
        const { error: upsertErr } = await supabase.from("leadsmart_users").upsert(
          { user_id: user.id, role: "user" },
          { onConflict: "user_id" }
        );
        if (upsertErr) {
          const msg = String(upsertErr?.message ?? "");
          const missingUserId = /user_id.*does not exist|column\s+.*user_id.*does not exist/i.test(msg);
          if (!missingUserId) throw upsertErr;
        }
        const { error: ptErr } = await supabase.from("propertytools_users").upsert(
          { user_id: user.id, tier: "basic" },
          { onConflict: "user_id" }
        );
        if (ptErr) {
          const msg = String(ptErr?.message ?? "");
          const missingUserId = /user_id.*does not exist|column\s+.*user_id.*does not exist/i.test(msg);
          if (!missingUserId) throw ptErr;
        }

        const after = safeInternalRedirect(searchParams.get("redirect"));
        router.push(after ?? "/");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err ?? "");
        setError(msg || "Could not save profile.");
      } finally {
        setLoading(false);
      }
      return;
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
        setSuccess("Check your email to confirm your account, then come back to log in.");
        return;
      }

      const phoneVal = phone.trim() ? formatUsPhoneStored(phone) : null;
      const { error: upProfErr1 } = await supabase.from("user_profiles").upsert(
        {
          user_id: userId,
          full_name: fullName.trim(),
          phone: phoneVal,
        },
        { onConflict: "user_id" }
      );

      if (upProfErr1) {
        const msg = String(upProfErr1?.message ?? "");
        const missingUserId = /user_id.*does not exist|column\s+.*user_id.*does not exist/i.test(
          msg
        );

        if (!missingUserId) {
          throw upProfErr1;
        }
      }

      const { error: upsertErr1 } = await supabase.from("leadsmart_users").upsert(
        { user_id: userId, role: "user" },
        { onConflict: "user_id" }
      );

      if (upsertErr1) {
        const msg = String(upsertErr1?.message ?? "");
        const missingUserId = /user_id.*does not exist|column\s+.*user_id.*does not exist/i.test(
          msg
        );

        if (!missingUserId) {
          throw upsertErr1;
        }
      }

      const { error: ptErr1 } = await supabase.from("propertytools_users").upsert(
        { user_id: userId, tier: "basic" },
        { onConflict: "user_id" }
      );

      if (ptErr1) {
        const msg = String(ptErr1?.message ?? "");
        const missingUserId = /user_id.*does not exist|column\s+.*user_id.*does not exist/i.test(
          msg
        );

        if (!missingUserId) {
          throw ptErr1;
        }
      }

      router.push("/");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e ?? "");
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
        {hasSession ? (
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-left text-[11px] font-medium text-sky-950">
            You&apos;re signed in — we filled this form from your account. Update anything below and save (no new
            password needed).
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={prefillLoading}
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
              readOnly={hasSession}
              title={hasSession ? "Email is tied to your signed-in account" : undefined}
              disabled={prefillLoading}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">Phone</label>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(formatUsPhoneInput(e.target.value))}
              placeholder="(Optional) Get instant alerts via SMS"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={prefillLoading}
            />
          </div>
          {!hasSession ? (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required={!hasSession}
                disabled={prefillLoading}
                autoComplete="new-password"
              />
            </div>
          ) : null}

          {error ? (
            <p className="text-[11px] text-red-600 font-medium whitespace-pre-line">{error}</p>
          ) : null}
          {success ? (
            <p className="text-[11px] text-emerald-700 font-medium whitespace-pre-line">{success}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading || prefillLoading}
            className="w-full inline-flex items-center justify-center bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (hasSession ? "Saving…" : "Creating account...") : hasSession ? "Save profile" : "Sign Up"}
          </button>
        </form>

        <p className="text-[11px] text-gray-500 text-center space-y-2">
          {hasSession ? (
            <>
              <span className="block">
                <Link href="/dashboard" className="text-blue-700 font-semibold">
                  Go to dashboard
                </Link>
                {" · "}
                <Link href="/agent-signup" className="text-blue-700 font-semibold">
                  Start agent setup
                </Link>
              </span>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <a className="text-blue-700 font-semibold" href="/login">
                Log in
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-gray-500">
          Loading…
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
