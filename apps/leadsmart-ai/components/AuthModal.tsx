"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { isRealEstateProfessionalRole } from "@/lib/paidSubscriptionEligibility";
import { shouldLandOnPortalAfterLogin } from "@/lib/portalLanding";

type Mode = "login" | "signup";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            if (shouldLandOnPortalAfterLogin(role, hasAgent)) {
              router.replace("/portal");
            } else if (isRealEstateProfessionalRole(role) || hasAgent) {
              router.replace("/dashboard");
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

      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } },
      });
      if (signUpErr) throw signUpErr;

      const userId = data?.user?.id;
      if (userId) {
        // Best-effort: create profile row (RLS may require policies).
        await supabase.from("user_profiles").upsert(
          {
            user_id: userId,
            role: "user",
            full_name: fullName.trim(),
          },
          { onConflict: "user_id" }
        );
      }

      onAuthenticated?.();
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

