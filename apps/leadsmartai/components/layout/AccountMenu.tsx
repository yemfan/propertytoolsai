"use client";

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
import {
  isAdminOrSupportRole,
  isAgentOrBrokerProfileRole,
  resolveRoleHomePath,
} from "@/lib/rolePortalPaths";

type MePayload = { role?: string; has_agent_record?: boolean; avatar_url?: string | null };

/** Match login / home redirect: consumers are `role === user` with no `agents` row. */
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
  /** Fixed position for portaled menu (avoids Topbar `overflow-x-auto` clipping). */
  const [placement, setPlacement] = useState<{ top: number; right: number } | null>(null);

  const updatePlacement = useCallback(() => {
    const el = buttonRef.current;
    if (!el || typeof window === "undefined") return;
    const r = el.getBoundingClientRect();
    setPlacement({
      top: r.bottom + 8,
      right: window.innerWidth - r.right,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
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
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!user) {
      setMe(null);
      return;
    }
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
        if (res.ok) {
          setMe(json);
        } else {
          /** e.g. 500 or session not visible server-side — keep links usable */
          setMe({ role: "user", has_agent_record: false });
        }
      } catch {
        if (!cancelled) {
          setMe({ role: "user", has_agent_record: false });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
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
        profileHref: getPropertyToolsConsumerAccountProfileUrl(),
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
      return {
        workspaceHref: getPropertyToolsConsumerPostLoginUrl(),
        profileHref: getPropertyToolsConsumerAccountProfileUrl(),
        settingsHref: getPropertyToolsConsumerAccountProfileUrl(),
        pricingHref: "/pricing",
        hideCommercialPricing: false,
        slimAgentBrokerHeaderMenu: false,
        hideAccountSettings: false,
      } as const;
    }
    const home = resolveRoleHomePath(role, hasAgent);
    const settings = hasAgent ? "/dashboard/settings" : "/portal";
    const slim =
      isAgentOrBrokerProfileRole(role) && !isAdminOrSupportRole(role);
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
  const avatarUrl = me?.avatar_url?.trim() || null;

  const menuPanel = (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-[200] w-[min(100vw-2rem,18rem)] rounded-xl border border-gray-200 bg-white py-1 text-gray-900 shadow-lg ring-1 ring-gray-900/5"
      style={
        placement
          ? {
              top: placement.top,
              right: placement.right,
            }
          : { visibility: "hidden", pointerEvents: "none" }
      }
    >
      <div className="border-b border-gray-100 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Signed in as</p>
        <p className="mt-1 break-all text-sm font-semibold text-gray-900">{email || "Your account"}</p>
        {me ? (
          <p className="mt-1 text-xs text-gray-600">{formatUserRoleLabel(me.role)}</p>
        ) : null}
      </div>
      <div className="py-1">
        {slimAgentBrokerHeaderMenu ? (
          <>
            <Link
              href="/account/profile"
              role="menuitem"
              className="block px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50"
              onClick={() => setOpen(false)}
            >
              Account
            </Link>
            <Link
              href="/portal"
              role="menuitem"
              className="block px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50"
              onClick={() => setOpen(false)}
            >
              Billing
            </Link>
          </>
        ) : (
          <>
            <Link
              href={workspaceHref}
              role="menuitem"
              className="block px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50"
              onClick={() => setOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              href={profileHref}
              role="menuitem"
              className="block px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50"
              onClick={() => setOpen(false)}
            >
              My profile
            </Link>
            {settingsHref !== profileHref && !hideAccountSettings ? (
              <Link
                href={settingsHref}
                role="menuitem"
                className="block px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50"
                onClick={() => setOpen(false)}
              >
                Account &amp; settings
              </Link>
            ) : null}
            {!hideCommercialPricing ? (
              <Link
                href={pricingHref}
                role="menuitem"
                className="block px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50"
                onClick={() => setOpen(false)}
              >
                Plans &amp; billing
              </Link>
            ) : null}
          </>
        )}
      </div>
      <div className="border-t border-gray-100 py-1">
        <button
          type="button"
          role="menuitem"
          className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-red-700 hover:bg-red-50"
          onClick={() => void onLogout()}
        >
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
        className="flex h-9 max-w-[10rem] items-center gap-2 rounded-full border border-gray-200 bg-white pl-1 pr-2.5 text-left text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-xs font-bold text-blue-800">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </span>
        <span className="hidden min-w-0 truncate sm:block">Account</span>
        <svg className="h-4 w-4 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && placement && typeof document !== "undefined"
        ? createPortal(menuPanel, document.body)
        : null}
    </div>
  );
}
