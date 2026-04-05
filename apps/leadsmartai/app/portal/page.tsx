"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  CreditCard,
  ExternalLink,
  Headphones,
  LayoutDashboard,
  Settings,
  User,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { isAdminOrSupportRole, isAgentOrBrokerProfileRole } from "@/lib/rolePortalPaths";

type PortalSection = {
  icon: React.ReactNode;
  label: string;
  description: string;
  href: string;
  external?: boolean;
  roles?: string[];
};

const PORTAL_SECTIONS: PortalSection[] = [
  {
    icon: <LayoutDashboard className="h-5 w-5" strokeWidth={2} />,
    label: "Dashboard",
    description: "Back to your main agent workspace",
    href: "/dashboard",
  },
  {
    icon: <CreditCard className="h-5 w-5" strokeWidth={2} />,
    label: "Billing & Subscription",
    description: "View your plan, invoices, and payment method",
    href: "/dashboard/billing",
  },
  {
    icon: <User className="h-5 w-5" strokeWidth={2} />,
    label: "Account & Profile",
    description: "Update your name, email, and preferences",
    href: "/account/profile",
  },
  {
    icon: <Settings className="h-5 w-5" strokeWidth={2} />,
    label: "Settings",
    description: "Notifications, integrations, and workspace settings",
    href: "/dashboard/settings",
  },
];

const ADMIN_SECTIONS: PortalSection[] = [
  {
    icon: <LayoutDashboard className="h-5 w-5" strokeWidth={2} />,
    label: "Platform Overview",
    description: "System-wide metrics and user activity",
    href: "/admin/platform-overview",
    roles: ["admin"],
  },
  {
    icon: <BarChart3 className="h-5 w-5" strokeWidth={2} />,
    label: "Founder Analytics",
    description: "Revenue, growth, and key business indicators",
    href: "/admin/founder",
    roles: ["admin"],
  },
  {
    icon: <CreditCard className="h-5 w-5" strokeWidth={2} />,
    label: "Admin Billing",
    description: "Manage all subscriptions and billing records",
    href: "/admin/billing",
    roles: ["admin"],
  },
  {
    icon: <Headphones className="h-5 w-5" strokeWidth={2} />,
    label: "Support Inbox",
    description: "Handle customer support tickets and conversations",
    href: "/admin/support",
    roles: ["admin", "support"],
  },
];

function SectionCard({ section }: { section: PortalSection }) {
  return (
    <Link
      href={section.href}
      className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#0072ce]/40 hover:shadow-md"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-[#0072ce]/10 group-hover:text-[#0072ce]">
        {section.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          {section.label}
          {section.external && (
            <ExternalLink className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
          )}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">{section.description}</p>
      </div>
      <span className="shrink-0 text-slate-300 transition group-hover:text-[#0072ce]">→</span>
    </Link>
  );
}

export default function PortalPage() {
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [appRole, setAppRole] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = supabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Not signed in");
        return;
      }
      const { data } = await supabase
        .from("leadsmart_users")
        .select("plan,subscription_status,role")
        .eq("user_id", user.id)
        .maybeSingle();
      const row = data as { plan?: string; subscription_status?: string; role?: string } | null;
      setPlan(row?.plan ?? null);
      setStatus(row?.subscription_status ?? null);
      setAppRole(row?.role ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load account");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openStripePortal() {
    setOpening(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not open billing portal");
      if (body.url) {
        window.location.assign(body.url);
        return;
      }
      throw new Error("Missing portal URL");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Portal failed");
    } finally {
      setOpening(false);
    }
  }

  const isAdmin = isAdminOrSupportRole(appRole);
  const isAgentBroker = isAgentOrBrokerProfileRole(appRole) && !isAdmin;

  const visibleAdminSections = ADMIN_SECTIONS.filter((s) => {
    if (!s.roles) return true;
    if (!appRole) return false;
    return s.roles.includes(appRole);
  });

  const statusColor =
    status === "active"
      ? { bg: "#dcfce7", text: "#166534" }
      : status === "trialing"
        ? { bg: "#dbeafe", text: "#1e40af" }
        : status === "past_due"
          ? { bg: "#fef9c3", text: "#854d0e" }
          : { bg: "#f1f5f9", text: "#475569" };

  return (
    <div className="mx-auto max-w-3xl space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-text">Portal</h1>
        <p className="mt-1 text-sm text-brand-text/60">
          Account, billing, settings, and admin tools.
        </p>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && !error.includes("No Stripe customer") && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      )}

      {/* ── Account summary card ───────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="h-1.5 w-full" style={{ background: "#0072CE" }} />
        <div className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Account summary
            </p>
            {loading ? (
              <div className="mt-2 h-5 w-32 animate-pulse rounded bg-slate-100" />
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold capitalize text-brand-text">
                  {plan ?? "No plan"}
                </span>
                {status && (
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize"
                    style={{ background: statusColor.bg, color: statusColor.text }}
                  >
                    {status.replace(/_/g, " ")}
                  </span>
                )}
                {appRole && (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold capitalize text-slate-600">
                    {appRole.replace(/_/g, " ")}
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={opening}
            onClick={() => void openStripePortal()}
            className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            {opening ? "Opening…" : "Manage billing →"}
          </button>
        </div>
      </div>

      {/* ── Account & workspace links ──────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">
          Account &amp; workspace
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {PORTAL_SECTIONS.filter((s) => {
            // Hide Settings for admin/support (they use admin tools instead)
            if (s.href === "/dashboard/settings" && isAdmin) return false;
            return true;
          }).map((section) => (
            <SectionCard key={section.href} section={section} />
          ))}
        </div>
      </div>

      {/* ── Admin / support tools ──────────────────────────────────────────── */}
      {visibleAdminSections.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">
            {isAdmin ? "Admin tools" : "Support tools"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleAdminSections.map((section) => (
              <SectionCard key={section.href} section={section} />
            ))}
          </div>
        </div>
      )}

      {/* ── Pricing link for agents ────────────────────────────────────────── */}
      {isAgentBroker && (
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Upgrade your plan</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Unlock more AI credits, automation, and CRM features.
          </p>
          <Link
            href="/agent/pricing"
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#0072ce] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
          >
            View plans →
          </Link>
        </div>
      )}
    </div>
  );
}
