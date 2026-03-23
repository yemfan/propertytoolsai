"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { safeInternalRedirect } from "@/lib/loginUrl";
import { isRealEstateProfessionalRole } from "@/lib/paidSubscriptionEligibility";
import { resolveRoleHomePath } from "@/lib/rolePortalPaths";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams?.get("redirect") ?? searchParams?.get("next");
  const reason = searchParams?.get("reason");

  const [email, setEmail] = useState("");

  useEffect(() => {
    const q = searchParams?.get("email");
    if (!q) return;
    try {
      setEmail(decodeURIComponent(q).trim());
    } catch {
      setEmail(q.trim());
    }
  }, [searchParams]);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      let role: string | null = null;
      let hasAgentRow = false;
      let isPro = false;
      if (user) {
        try {
          const missingUserId = (err: any) => {
            const msg = String(err?.message ?? "");
            return (
              /user_id.*does not exist/i.test(msg) ||
              /column\s+.*user_id.*does not exist/i.test(msg)
            );
          };

          let userRow: any = null;
          let rowErr: any = null;
          ({ data: userRow, error: rowErr } = await supabase
            .from("user_profiles")
            .select("role")
            .eq("user_id", user.id)
            .maybeSingle());

          if (rowErr && missingUserId(rowErr)) {
            rowErr = null;
          }

          const r = (userRow as { role?: string } | null)?.role;
          role = r ?? null;

          const { data: agentRow } = await supabase
            .from("agents")
            .select("id")
            .eq("auth_user_id", user.id)
            .maybeSingle();
          hasAgentRow = !!agentRow;

          if (!rowErr && r === "user" && !hasAgentRow) {
            isPro = false;
          } else {
            isPro = isRealEstateProfessionalRole(r) || hasAgentRow;
          }
        } catch {
          const { data: agentRow } = await supabase
            .from("agents")
            .select("id")
            .eq("auth_user_id", user.id)
            .maybeSingle();
          hasAgentRow = !!agentRow;
          isPro = hasAgentRow;
        }
      }

      const safe = redirectParam ? safeInternalRedirect(redirectParam) : null;
      if (isPro) {
        if (safe) {
          router.replace(safe);
        } else {
          router.replace(resolveRoleHomePath(role, hasAgentRow));
        }
      } else {
        const fallback = redirectParam ?? "/dashboard";
        const safeFallback = safeInternalRedirect(fallback);
        router.replace(
          fallback.startsWith("/dashboard") ? "/" : (safeFallback ?? "/")
        );
      }
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-5">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-bold text-gray-900">Log in to LeadSmart AI</h1>
          <p className="text-xs text-gray-600">
            Access your agent dashboard and manage your home value leads.
          </p>
        </div>
        {reason === "trial" ? (
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-center text-[11px] font-medium text-sky-950">
            Sign in to continue. Next, we’ll open secure Stripe checkout for your Pro free trial (card on file; you are
            not charged until the trial ends).
          </p>
        ) : null}
        {reason === "checkout" ? (
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-center text-[11px] font-medium text-sky-950">
            Sign in to continue to checkout. We’ll return you to pricing right after.
          </p>
        ) : null}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="email"
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
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <p className="text-[11px] text-red-600 font-medium whitespace-pre-line">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>
        <div className="text-[11px] text-gray-500 text-center space-y-2">
          <p>
            New user?{" "}
            <a className="text-blue-700 font-semibold" href="/signup">
              Sign up
            </a>
          </p>
          <p>
            Real estate agent?{" "}
            <a className="text-blue-700 font-semibold" href="/agent-signup">
              Start free as agent
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

