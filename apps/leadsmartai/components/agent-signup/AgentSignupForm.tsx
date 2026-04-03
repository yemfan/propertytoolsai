"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  useSignupProfilePrefill,
  type SignupOverlayPrefill,
  type SignupPrefillAgent,
} from "@/lib/hooks/useSignupProfilePrefill";
import { safeInternalRedirect } from "@/lib/loginUrl";
import { messageFromUnknownError } from "@/lib/supabaseThrow";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { START_FREE_AS_AGENT_LABEL } from "@/lib/auth/startFreeAgentMarketing";
import { formatUsPhoneInput, formatUsPhoneStored, isValidUsPhone } from "@/lib/usPhone";

type AgentSignupFormProps = {
  /** Full page vs compact card (dialog). */
  layout?: "page" | "dialog";
  /** When opened from a dialog, merge name/email before URL/session. */
  overlayPrefill?: SignupOverlayPrefill | null;
  onClose?: () => void;
  /** Called after successful agent setup before navigation (e.g. close dialog). */
  onSuccess?: () => void;
};

export function AgentSignupForm({
  layout = "page",
  overlayPrefill = null,
  onClose,
  onSuccess,
}: AgentSignupFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { values: prefill, hasSession, loading: prefillLoading } = useSignupProfilePrefill(
    "agent",
    overlayPrefill
  );
  const pv = prefill as SignupPrefillAgent;

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [brokerage, setBrokerage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (prefillLoading) return;
    setFullName(pv.fullName);
    setPhone(pv.phone ? formatUsPhoneInput(pv.phone) : "");
    setLicenseNumber(pv.licenseNumber);
    setBrokerage(pv.brokerage);
    setEmail(pv.email);
  }, [prefillLoading, pv]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
    if (!hasSession && (!password.trim() || password.length < 6)) {
      return setError("Password must be at least 6 characters.");
    }

    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      const phoneStored = formatUsPhoneStored(phone)!;

      if (hasSession) {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!user) throw new Error("Session expired. Please log in again.");

        const { error: upProfErr } = await supabase.from("user_profiles").upsert(
          {
            user_id: user.id,
            full_name: fullName.trim(),
            phone: phoneStored,
          },
          { onConflict: "user_id" }
        );
        if (upProfErr) {
          const msg = String(upProfErr?.message ?? "");
          const missingUserId = /user_id.*does not exist|column\s+.*user_id.*does not exist/i.test(msg);
          if (!missingUserId) throw upProfErr;
        }
        const { error: upsertUserErr1 } = await supabase.from("leadsmart_users").upsert(
          {
            user_id: user.id,
            role: "agent",
            license_number: licenseNumber.trim() || null,
            brokerage: brokerage.trim() || null,
          },
          { onConflict: "user_id" }
        );
        if (upsertUserErr1) {
          const msg = String(upsertUserErr1?.message ?? "");
          const missingUserId = /user_id.*does not exist|column\s+.*user_id.*does not exist/i.test(msg);
          if (!missingUserId) throw upsertUserErr1;
        }

        const { error: upsertAgentErr } = await supabase.from("agents").upsert(
          {
            auth_user_id: user.id,
            plan_type: "free",
          } as Record<string, unknown>,
          { onConflict: "auth_user_id" }
        );
        if (upsertAgentErr) throw upsertAgentErr;

        onSuccess?.();
        const after = safeInternalRedirect(searchParams.get("redirect"));
        router.push(after ?? "/dashboard");
        onClose?.();
        return;
      }

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

      const { error: upProfErr } = await supabase.from("user_profiles").upsert(
        {
          user_id: userId,
          full_name: fullName.trim(),
          phone: phoneStored,
        },
        { onConflict: "user_id" }
      );
      if (upProfErr) {
        const msg = String(upProfErr?.message ?? "");
        const missingUserId = /user_id.*does not exist|column\s+.*user_id.*does not exist/i.test(
          msg
        );

        if (!missingUserId) {
          throw upProfErr;
        }
      }
      const { error: upsertUserErr1 } = await supabase.from("leadsmart_users").upsert(
        {
          user_id: userId,
          role: "agent",
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

        if (!missingUserId) {
          throw upsertUserErr1;
        }
      }

      const { error: upsertAgentErr } = await supabase.from("agents").upsert(
        {
          auth_user_id: userId,
          plan_type: "free",
        } as Record<string, unknown>,
        { onConflict: "auth_user_id" }
      );
      if (upsertAgentErr) throw upsertAgentErr;

      onSuccess?.();
      const after = safeInternalRedirect(searchParams.get("redirect"));
      router.push(after ?? "/dashboard");
      onClose?.();
    } catch (e: unknown) {
      const msg = messageFromUnknownError(e, "Agent signup failed.");
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

  const inner = (
    <div
      className={
        layout === "page"
          ? "w-full max-w-sm bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-5"
          : "w-full max-w-sm space-y-5"
      }
    >
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-bold text-gray-900">
          {hasSession ? "Complete agent setup" : START_FREE_AS_AGENT_LABEL}
        </h1>
        <p className="text-xs text-gray-600">Get access to the agent portal and CMA tools.</p>
        {hasSession ? (
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-medium text-sky-950">
            You&apos;re signed in — we filled this form from your account. Finish the fields below to activate your
            agent profile (no new password needed).
          </p>
        ) : null}
        <p className="pt-2 text-[11px] text-gray-500">
          Prefer a 2-minute interactive preview first?{" "}
          <Link
            href="/onboarding"
            className="font-semibold text-blue-700 hover:underline"
            onClick={() => onClose?.()}
          >
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
            placeholder="(Required) Agent alerts + follow-ups"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            disabled={prefillLoading}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">License number (optional)</label>
          <input
            type="text"
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={prefillLoading}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">Brokerage (optional)</label>
          <input
            type="text"
            value={brokerage}
            onChange={(e) => setBrokerage(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

        {!hasSession ? (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required={!hasSession}
              autoComplete="new-password"
              disabled={prefillLoading}
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
          {loading ? "Saving…" : hasSession ? "Save agent profile" : "Create Agent Account"}
        </button>
      </form>

      <p className="text-[11px] text-gray-500 text-center">
        Prefer regular user signup?{" "}
        <a className="text-blue-700 font-semibold" href="/signup" onClick={() => onClose?.()}>
          Sign up here
        </a>
      </p>
    </div>
  );

  if (layout === "page") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">{inner}</div>
    );
  }

  return inner;
}
