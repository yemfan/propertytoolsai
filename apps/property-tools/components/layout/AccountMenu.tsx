"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAccess } from "@/components/AccessProvider";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

function tierLabel(tier: string, plan: string | null) {
  if (tier === "premium") return "Premium";
  const p = (plan ?? "free").toLowerCase();
  if (p === "pro") return "Pro";
  return "Free";
}

export default function AccountMenu() {
  const { tier, usage, loading, refresh } = useAccess();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function onLogout() {
    setOpen(false);
    try {
      await supabaseBrowser().auth.signOut();
    } catch (e) {
      console.error(e);
    } finally {
      await refresh();
      router.refresh();
      router.push("/");
    }
  }

  if (loading || !usage?.userId) return null;

  const email = usage.email?.trim() || "";
  const initial = email ? email[0]!.toUpperCase() : "?";
  const status = usage.subscriptionStatus ? String(usage.subscriptionStatus) : "";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 max-w-[10rem] items-center gap-2 rounded-full border border-slate-200 bg-white pl-1 pr-2.5 text-left text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800">
          {initial}
        </span>
        <span className="hidden min-w-0 truncate sm:block">Account</span>
        <svg className="h-4 w-4 shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,18rem)] rounded-xl border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-slate-900/5"
          role="menu"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Signed in as</p>
            <p className="mt-1 break-all text-sm font-semibold text-slate-900">{email || "Your account"}</p>
            <p className="mt-1 text-xs text-slate-600">
              {tierLabel(tier, usage.plan)}
              {status ? <span className="text-slate-400"> · {status}</span> : null}
            </p>
          </div>
          <div className="py-1">
            <Link
              href="/dashboard"
              role="menuitem"
              className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/settings"
              role="menuitem"
              className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              Account &amp; settings
            </Link>
            <Link
              href="/pricing"
              role="menuitem"
              className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              Plans &amp; pricing
            </Link>
          </div>
          <div className="border-t border-slate-100 py-1">
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
      ) : null}
    </div>
  );
}
