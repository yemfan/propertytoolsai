"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fullNameFromUserMetadata } from "@/lib/auth/canonicalUserContact";
import { sendPasswordResetEmail } from "@/lib/auth/sendPasswordResetEmail";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { isRealEstateProfessionalRole } from "@/lib/paidSubscriptionEligibility";
import { getPropertyToolsConsumerPostLoginUrl } from "@/lib/propertyToolsConsumerUrl";
import {
  isSignupRoleAssigned,
  SIGNUP_ROLE_OPTIONS,
  signupRoleToDbRole,
} from "@/lib/auth/signupRoleOptions";
import { resolveRoleHomePath } from "@/lib/rolePortalPaths";
import { getOAuthRedirectOrigin } from "@/lib/siteUrl";
import { formatUsPhoneInput, formatUsPhoneStored, isValidUsPhone } from "@/lib/usPhone";

type Mode = "login" | "signup";
/** After signup as Real Estate Agent — show Start free CTA before closing. */
type SignupStep = "form" | "agentStartFree";

export default function AuthModal({
  open,
  onClose,
  initialMode = "login",
  onAuthenticated,
}: {
  open: boolean;
  onClose: () => void;
  initialMode?: Mode;
  onAuthenticated?: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [signupRole, setSignupRole] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSending, setResetSending] = useState(false);
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  const [signupStep, setSignupStep] = useState<SignupStep>("form");

  /**
   * Reset post-signup agent step whenever the modal closes — otherwise `signupStep` stays
   * `agentStartFree` and the next open paints the agent dialog before `open===true` effects run
   * (looks like “Start free” popup on first click / first visit in-session).
   */
  useEffect(() => {
    if (!open) {
      setSignupStep("form");
      return;
    }
    setMode(initialMode ?? "login");
    setError(null);
    setResetNotice(null);
    setSignupRole("");
    setPhone("");
    setSignupStep("form");

    let cancelled = false;
    (async () => {
      try {
        const supabase = supabaseBrowser();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled || !session?.user) return;
        const u = session.user;
        const { data: prof } = await supabase
          .from("user_profiles")
          .select("full_name, phone, leadsmart_users(role)")
          .eq("user_id", u.id)
          .maybeSingle();
        const row = prof as {
          full_name?: string | null;
          phone?: string | null;
          leadsmart_users?: { role?: string | null } | null;
        } | null;
        const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
        const metaName = fullNameFromUserMetadata(meta) ?? "";
        const metaPhone = typeof meta.phone === "string" ? meta.phone.trim() : "";
        setEmail(u.email?.trim() ?? "");
        setFullName(row?.full_name?.trim() || metaName || "");
        setPhone(formatUsPhoneInput(row?.phone?.trim() || metaPhone || ""));
      } catch (e) {
        console.error("[AuthModal] session prefill", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  async function signInWithOAuth(provider: "google" | "apple") {
    setError(null);
    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      const next = `${window.location.pathname}${window.location.search}`;
      const origin = getOAuthRedirectOrigin();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next || "/")}`,
        },
      });
      if (oauthError) throw oauthError;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sign in failed.");
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setError(null);
    setResetNotice(null);
    setResetSending(true);
    try {
      const result = await sendPasswordResetEmail(email);
      if (result.ok === false) {
        setError(result.message);
        return;
      }
      setResetNotice("Check your email for a link to reset your password.");
    } finally {
      setResetSending(false);
    }
  }

  function finishAndCloseAgentStartFree() {
    setSignupStep("form");
    onClose();
    router.refresh?.();
  }

  /** After signup as agent — “Start free” upsell before entering the app. */
  if (signupStep === "agentStartFree") {
    const dashboardHref = resolveRoleHomePath("agent", false);
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <button
          type="button"
          className="absolute inset-0 z-0 cursor-pointer border-0 bg-slate-900/40 p-0 backdrop-blur-sm"
          aria-label="Close"
          onClick={() => finishAndCloseAgentStartFree()}
        />
        <div
          className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="agent-start-free-title"
        >
          <div className="border-b border-slate-200 bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white">
            <div id="agent-start-free-title" className="text-lg font-bold">
              You&apos;re in — welcome, agent
            </div>
            <p className="mt-2 text-sm text-blue-100">
              Start free with LeadSmart AI: explore the CRM, AI tools, and your pipeline — no credit card required to
              get started.
            </p>
          </div>
          <div className="space-y-3 p-5">
            <a
              href="/pricing"
              className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              onClick={() => finishAndCloseAgentStartFree()}
            >
              Start free (view plans)
            </a>
            <button
              type="button"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              onClick={() => {
                finishAndCloseAgentStartFree();
                router.push(dashboardHref);
              }}
            >
              Go to dashboard
            </button>
            <button
              type="button"
              className="w-full rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              onClick={() => finishAndCloseAgentStartFree()}
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        onAuthenticated?.();
        onClose();
        router.refresh?.();

        // If the signed-in user is an agent, take them straight to the dashboard.
        // (Homepage stays public; this is only the post-auth UX.)
        try {
          const meRes = await fetch("/api/me", { credentials: "include" });
          if (meRes.ok) {
            const me = (await meRes.json()) as {
              role?: string;
              has_agent_record?: boolean;
            };
            const role = me?.role ?? null;
            const hasAgent = Boolean(me?.has_agent_record);
            if (isRealEstateProfessionalRole(role) || hasAgent) {
              router.replace(resolveRoleHomePath(role, hasAgent));
            } else {
              window.location.assign(getPropertyToolsConsumerPostLoginUrl());
            }
          }
        } catch {
          // Best-effort: if /api/me fails, we just keep the current page refresh.
        }
        return;
      }

      if (!fullName.trim()) {
        setError("Name is required.");
        return;
      }

      if (isSignupRoleAssigned(signupRole)) {
        const p = phone.trim();
        if (!p) {
          setError("Phone number is required when a role is selected.");
          return;
        }
        if (!isValidUsPhone(p)) {
          setError("Enter a valid US phone number (10 digits).");
          return;
        }
      } else if (phone.trim() && !isValidUsPhone(phone)) {
        setError("Phone must be a valid US number (10 digits) if provided.");
        return;
      }

      const dbRole = signupRoleToDbRole(signupRole);
      const phoneForProfile = phone.trim() ? formatUsPhoneStored(phone) : null;

      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phoneForProfile ?? undefined,
          },
        },
      });
      if (signUpErr) throw signUpErr;

      const userId = data?.user?.id;
      if (userId) {
        // Best-effort: create profile row (RLS may require policies).
        await supabase.from("user_profiles").upsert(
          {
            user_id: userId,
            full_name: fullName.trim(),
            phone: phoneForProfile,
          } as Record<string, unknown>,
          { onConflict: "user_id" }
        );
        await supabase.from("leadsmart_users").upsert(
          {
            user_id: userId,
            role: dbRole,
            oauth_onboarding_completed: true,
          } as Record<string, unknown>,
          { onConflict: "user_id" }
        );
        if (dbRole === "user") {
          await supabase.from("propertytools_users").upsert(
            { user_id: userId, tier: "basic" } as Record<string, unknown>,
            { onConflict: "user_id" }
          );
        }
      }

      onAuthenticated?.();

      // New agents: show “Start free” dialog before closing (email-confirm signups skip — no userId yet).
      if (userId && dbRole === "agent") {
        setSignupStep("agentStartFree");
        router.refresh?.();
        return;
      }

      // Consumers belong on PropertyToolsAI, not LeadSmart.
      if (userId && dbRole === "user") {
        onClose();
        window.location.assign(getPropertyToolsConsumerPostLoginUrl());
        return;
      }

      onClose();
      router.refresh?.();
    } catch (e: any) {
      setError(e?.message ?? "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-pointer border-0 bg-slate-900/40 p-0 backdrop-blur-sm"
        aria-label="Close"
        onClick={() => !loading && onClose()}
      />

      <div
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Sign in or create account"
      >
        <button
          type="button"
          onClick={() => !loading && onClose()}
          disabled={loading}
          className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Close"
        >
          <X className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
        <div className="p-4 pt-12 sm:p-5 sm:pt-12 space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 text-sm font-semibold px-3 py-2 rounded-lg border ${
                mode === "login"
                  ? "bg-white border-slate-300 text-slate-900"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-white"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 text-sm font-semibold px-3 py-2 rounded-lg border ${
                mode === "signup"
                  ? "bg-white border-slate-300 text-slate-900"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-white"
              }`}
            >
              Sign Up
            </button>
          </div>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span className="bg-white px-2">Or continue with</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void signInWithOAuth("google")}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Continue with Google
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void signInWithOAuth("apple")}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Continue with Apple
            </button>
          </div>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span className="bg-white px-2">Email</span>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" ? (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  Name
                </label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Your name"
                  autoComplete="name"
                />
              </div>
            ) : null}

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="email"
                required
              />
            </div>

            {mode === "signup" ? (
              <>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Role
                  </label>
                  <select
                    value={signupRole}
                    onChange={(e) => setSignupRole(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Role"
                  >
                    {SIGNUP_ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value || "none"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Phone number
                    {isSignupRoleAssigned(signupRole) ? (
                      <span className="text-red-600"> *</span>
                    ) : (
                      <span className="font-normal text-slate-500"> (optional)</span>
                    )}
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatUsPhoneInput(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoComplete="tel"
                    placeholder="(555) 555-5555"
                    required={isSignupRoleAssigned(signupRole)}
                  />
                </div>
              </>
            ) : null}

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
              />
              {mode === "login" ? (
                <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => void handleForgotPassword()}
                    disabled={loading || resetSending}
                    className="text-left text-xs font-semibold text-blue-700 hover:text-blue-800 disabled:opacity-50"
                  >
                    {resetSending ? "Sending…" : "Email me a reset link"}
                  </button>
                  <Link
                    href="/forgot-password"
                    onClick={() => onClose()}
                    className="text-xs font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800"
                  >
                    Forgot password?
                  </Link>
                </div>
              ) : null}
            </div>

            {resetNotice ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-900">
                {resetNotice}
              </p>
            ) : null}

            {error ? (
              <p className="text-[11px] text-red-600 font-medium whitespace-pre-line">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading
                ? mode === "login"
                  ? "Logging in..."
                  : "Creating account..."
                : mode === "login"
                ? "Log in"
                : "Create free account"}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="w-full inline-flex items-center justify-center rounded-xl bg-white border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Not now
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

