"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  isSignupRoleAssigned,
  SIGNUP_ROLE_OPTIONS,
  signupRoleToDbRole,
} from "@/lib/auth/signupRoleOptions";
import { getPropertyToolsConsumerPostLoginUrl } from "@/lib/propertyToolsConsumerUrl";
import { isRealEstateProfessionalRole } from "@/lib/paidSubscriptionEligibility";
import { resolveRoleHomePath } from "@/lib/rolePortalPaths";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { formatUsPhoneInput, formatUsPhoneStored, isValidUsPhone } from "@/lib/usPhone";

export default function CompleteProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
          Loading…
        </div>
      }
    >
      <CompleteProfileInner />
    </Suspense>
  );
}

function CompleteProfileInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next") ?? "/";
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [signupRole, setSignupRole] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = supabaseBrowser();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) {
          router.replace(`/login?redirect=${encodeURIComponent("/auth/complete-profile")}`);
          return;
        }
        const u = session.user;
        const { data: prof } = await supabase
          .from("user_profiles")
          .select("full_name, phone, leadsmart_users(role, oauth_onboarding_completed)")
          .eq("user_id", u.id)
          .maybeSingle();
        const row = prof as {
          full_name?: string | null;
          phone?: string | null;
          leadsmart_users?: { role?: string | null; oauth_onboarding_completed?: boolean | null } | null;
        } | null;
        const ls = row?.leadsmart_users;
        const lsOne = Array.isArray(ls) ? ls[0] : ls;
        if (lsOne?.oauth_onboarding_completed === true) {
          router.replace(next);
          return;
        }
        const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
        const metaName =
          typeof meta.full_name === "string"
            ? meta.full_name.trim()
            : typeof meta.name === "string"
              ? meta.name.trim()
              : "";
        if (!cancelled) {
          setEmail(u.email?.trim() ?? "");
          setFullName(row?.full_name?.trim() || metaName || "");
          setPhone(formatUsPhoneInput(row?.phone?.trim() || ""));
          const r = lsOne?.role ?? "user";
          if (r === "user") setSignupRole("");
          else if (SIGNUP_ROLE_OPTIONS.some((o) => o.value === r)) setSignupRole(r);
          else setSignupRole("");
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Could not load your profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [next, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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

    setSaving(true);
    try {
      const { data: sessionData } = await supabaseBrowser().auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phoneForProfile,
          role: dbRole,
          oauth_onboarding_completed: true,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Could not save profile");
      }

      const meRes = await fetch("/api/me", { credentials: "include" });
      const me = meRes.ok ? ((await meRes.json()) as { role?: string; has_agent_record?: boolean }) : null;
      const role = me?.role ?? dbRole;
      const hasAgent = Boolean(me?.has_agent_record);

      if (dbRole === "user") {
        window.location.href = getPropertyToolsConsumerPostLoginUrl();
        return;
      }

      if (isRealEstateProfessionalRole(role) || hasAgent) {
        router.replace(resolveRoleHomePath(role, hasAgent));
        router.refresh();
        return;
      }

      window.location.href = getPropertyToolsConsumerPostLoginUrl();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Complete your profile</h1>
        <p className="mt-2 text-sm text-slate-600">
          You signed in with Google or Apple. Tell us your name, role, and how to reach you so we can route you to the
          right experience.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              readOnly
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="name"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">Role</label>
            <select
              value={signupRole}
              onChange={(e) => setSignupRole(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="tel"
              placeholder="(555) 555-5555"
              required={isSignupRoleAssigned(signupRole)}
            />
          </div>

          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Continue"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          <Link href="/" className="font-medium text-blue-700 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
