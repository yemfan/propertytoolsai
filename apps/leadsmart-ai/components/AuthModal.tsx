"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { isRealEstateProfessionalRole } from "@/lib/paidSubscriptionEligibility";
import { resolveRoleHomePath } from "@/lib/rolePortalPaths";

type Mode = "login" | "signup";
/** After signup as Real Estate Agent — show Start free CTA before closing. */
type SignupStep = "form" | "agentStartFree";

const SIGNUP_ROLE_OPTIONS = [
  { value: "", label: "Not Assigned" },
  { value: "agent", label: "Real Estate Agent" },
  { value: "broker", label: "Loan Broker" },
  { value: "support", label: "System Support" },
] as const;

function signupRoleToDbRole(value: string): string {
  return value === "" ? "user" : value;
}

function isSignupRoleAssigned(value: string): boolean {
  return value !== "";
}

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
  const [signupStep, setSignupStep] = useState<SignupStep>("form");

  const header = useMemo(
    () => ({
      title: "🔒 Account Required",
      description:
        "Create a free account to access advanced tools like:\n\n• AI Deal Analyzer\n• CMA Reports\n• Rental Property Analysis\n• Seller Presentation\n\nTakes less than 10 seconds 🚀",
    }),
    []
  );

  useEffect(() => {
    if (open) {
      setMode(initialMode ?? "login");
      setError(null);
      setSignupRole("");
      setPhone("");
      setSignupStep("form");
    }
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
              Start free with LeadSmart: explore the CRM, AI tools, and your pipeline — no credit card required to
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
        const digits = p.replace(/\D/g, "");
        if (digits.length < 10) {
          setError("Enter a valid phone number (at least 10 digits).");
          return;
        }
      }

      const dbRole = signupRoleToDbRole(signupRole);
      const phoneForProfile = phone.trim() || null;

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
            role: dbRole,
            full_name: fullName.trim(),
            phone: phoneForProfile,
          },
          { onConflict: "user_id" }
        );
      }

      onAuthenticated?.();

      // New agents: show “Start free” dialog before closing (email-confirm signups skip — no userId yet).
      if (userId && dbRole === "agent") {
        setSignupStep("agentStartFree");
        router.refresh?.();
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
      >
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200">
          <div className="text-sm font-bold text-slate-900">{header.title}</div>
          <p className="mt-1 text-xs text-slate-700 whitespace-pre-line">
            {header.description}
          </p>
          <div className="mt-3 text-[11px] font-semibold text-slate-600">
            No credit card required
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
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
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoComplete="tel"
                    placeholder={
                      isSignupRoleAssigned(signupRole) ? "Required for your role" : ""
                    }
                    required={isSignupRoleAssigned(signupRole)}
                  />
                </div>
              </>
            ) : null}

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">
                Password
              </label>
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
            </div>

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

