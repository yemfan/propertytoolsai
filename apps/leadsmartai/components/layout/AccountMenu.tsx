"use client";

import { ChevronDown, CreditCard, Home, LogOut, Settings, User } from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatUserRoleLabel } from "@leadsmart/shared";
import { useAuth } from "@/components/AuthProvider";
import { signOutWithFullReload } from "@/lib/auth/signOutClient";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { isRealEstateProfessionalRole } from "@/lib/paidSubscriptionEligibility";
import {
  getPropertyToolsConsumerAccountProfileUrl,
  getPropertyToolsConsumerPostLoginUrl,
} from "@/lib/propertyToolsConsumerUrl";
import { consumerShouldUsePropertyToolsApp } from "@/lib/signupOriginApp";
import {
  isAdminOrSupportRole,
  isAgentOrBrokerProfileRole,
  resolveRoleHomePath,
} from "@/lib/rolePortalPaths";

type MePayload = {
  role?: string;
  has_agent_record?: boolean;
  avatar_url?: string | null;
  signup_origin_app?: string | null;
};

function isProfessionalUser(role: string | null | undefined, hasAgentRecord: boolean): boolean {
  const r = String(role ?? "user").toLowerCase().trim();
  if (r === "user" && !hasAgentRecord) return false;
  return isRealEstateProfessionalRole(r) || hasAgentRecord;
}

export default function AccountMenu() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [me, setMe] = useState<MePayload | null>(null);
  const [placement, setPlacement] = useState<{ top: number; right: number } | null>(null);

  const updatePlacement = useCallback(() => {
    const el = buttonRef.current;
    if (!el || typeof window === "undefined") return;
    const r = el.getBoundingClientRect();
    setPlacement({ top: r.bottom + 8, right: window.innerWidth - r.right });
  }, []);

  useLayoutEffect(() => {
    if (!open) { setPlacement(null); return; }
    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open, updatePlacement]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!user) { setMe(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data: sessionData } = await supabaseBrowser().auth.getSession();
        const token = sessionData.session?.access_token;
        const res = await fetch("/api/me", {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const json = (await res.json().catch(() => ({}))) as MePayload & Record<string, unknown>;
        if (cancelled) return;
        setMe(res.ok ? json : { role: "user", has_agent_record: false });
      } catch {
        if (!cancelled) setMe({ role: "user", has_agent_record: false });
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const {
    workspaceHref,
    profileHref,
    settingsHref,
    pricingHref,
    hideCommercialPricing,
    slimAgentBrokerHeaderMenu,
    hideAccountSettings,
  } = useMemo(() => {
    if (!me) {
      return {
        workspaceHref: "/",
        profileHref: "/account/profile",
        settingsHref: "/dashboard/settings",
        pricingHref: "/pricing",
        hideCommercialPricing: false,
        slimAgentBrokerHeaderMenu: false,
        hideAccountSettings: false,
      } as const;
    }
    const role = me.role ?? "user";
    const hasAgent = Boolean(me.has_agent_record);
    const pro = isProfessionalUser(role, hasAgent);
    if (!pro) {
      const pt = consumerShouldUsePropertyToolsApp(me.signup_origin_app);
      return {
        workspaceHref: pt ? getPropertyToolsConsumerPostLoginUrl() : "/",
        profileHref: pt ? getPropertyToolsConsumerAccountProfileUrl() : "/account/profile",
        settingsHref: pt ? getPropertyToolsConsumerAccountProfileUrl() : "/account/profile",
        pricingHref: "/pricing",
        hideCommercialPricing: false,
        slimAgentBrokerHeaderMenu: false,
        hideAccountSettings: false,
      } as const;
    }
    const home = resolveRoleHomePath(role, hasAgent);
    const settings = hasAgent ? "/dashboard/settings" : "/portal";
    const slim = isAgentOrBrokerProfileRole(role) && !isAdminOrSupportRole(role);
    const staff = isAdminOrSupportRole(role);
    return {
      workspaceHref: home,
      profileHref: "/account/profile",
      settingsHref: settings,
      pricingHref: "/agent/pricing",
      hideCommercialPricing: staff,
      slimAgentBrokerHeaderMenu: slim,
      hideAccountSettings: staff,
    } as const;
  }, [me]);

  async function onLogout() {
    setOpen(false);
    await signOutWithFullReload("/");
  }

  if (loading || !user) return null;

  const email = user.email?.trim() || "";
  const initial = email ? email[0]!.toUpperCase() : "?";
  const shortEmail = email.length > 22 ? `${email.slice(0, 20)}…` : email;
  const avatarUrl = me?.avatar_url?.trim() || null;
  const roleLabel = me ? formatUserRoleLabel(me.role) : "";

  const menuItem = "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50";

  const menuPanel = (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-[200] w-[min(100vw-2rem,19rem)] rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/[0.04]"
      style={
        placement
          ? { top: placement.top, right: placement.right }
          : { visibility: "hidden", pointerEvents: "none" }
      }
    >
      <div className="border-b border-slate-100 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Signed in as</p>
        <p className="mt-1 break-all text-sm font-semibold text-slate-900">{email || "Your account"}</p>
        {roleLabel ? <p className="mt-1 text-xs text-slate-500">{roleLabel}</p> : null}
      </div>
      <div className="mt-1 space-y-0.5">
        {slimAgentBrokerHeaderMenu ? (
          <>
            <Link href="/account/profile" role="menuitem" className={menuItem} onClick={() => setOpen(false)}>
              <User className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={2} aria-hidden />
              Account
            </Link>
            <Link href="/portal" role="menuitem" className={menuItem} onClick={() => setOpen(false)}>
              <CreditCard className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={2} aria-hidden />
              Billing
            </Link>
          </>
        ) : (
          <>
            <Link href={workspaceHref} role="menuitem" className={menuItem} onClick={() => setOpen(false)}>
              <Home className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={2} aria-hidden />
              Dashboard
            </Link>
            <Link href={profileHref} role="menuitem" className={menuItem} onClick={() => setOpen(false)}>
              <User className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={2} aria-hidden />
              My profile
            </Link>
            {settingsHref !== profileHref && !hideAccountSettings ? (
              <Link href={settingsHref} role="menuitem" className={menuItem} onClick={() => setOpen(false)}>
                <Settings className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={2} aria-hidden />
                Account &amp; settings
              </Link>
            ) : null}
            {!hideCommercialPricing ? (
              <Link href={pricingHref} role="menuitem" className={menuItem} onClick={() => setOpen(false)}>
                <CreditCard className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={2} aria-hidden />
                Billing
              </Link>
            ) : null}
          </>
        )}
      </div>
      <div className="mt-1 border-t border-slate-100 pt-1">
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
          onClick={() => void onLogout()}
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 max-w-[200px] items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-2 py-1 text-left shadow-sm ring-1 ring-slate-900/[0.03] transition hover:border-slate-300 hover:bg-slate-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 sm:max-w-[240px] sm:gap-2.5 sm:px-2.5"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-slate-800 to-slate-900 text-xs font-bold text-white shadow-inner shadow-white/10 ring-2 ring-slate-100">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="User profile photo" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </span>
        <span className="hidden min-w-0 flex-1 sm:block">
          <span className="block truncate text-sm font-semibold text-slate-900">Account</span>
          <span className="block truncate text-xs text-slate-500">{shortEmail || "Signed in"}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
      </button>

      {open && placement && typeof document !== "undefined"
        ? createPortal(menuPanel, document.body)
        : null}
    </div>
  );
}
