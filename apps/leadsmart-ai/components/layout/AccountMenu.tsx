"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function AccountMenu() {
  const { user, loading, refresh } = useAuth();
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

  if (loading || !user) return null;

  const email = user.email?.trim() || "";
  const initial = email ? email[0]!.toUpperCase() : "?";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 max-w-[10rem] items-center gap-2 rounded-full border border-gray-200 bg-white pl-1 pr-2.5 text-left text-sm font-semibold text-brand-text shadow-sm hover:bg-brand-surface"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800">
          {initial}
        </span>
        <span className="hidden min-w-0 truncate sm:block">Account</span>
        <svg className="h-4 w-4 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,18rem)] rounded-xl border border-gray-200 bg-white py-1 shadow-lg ring-1 ring-gray-900/5"
          role="menu"
        >
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Signed in as</p>
            <p className="mt-1 break-all text-sm font-semibold text-gray-900">{email || "Your account"}</p>
          </div>
          <div className="py-1">
            <Link
              href="/dashboard"
              role="menuitem"
              className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/settings"
              role="menuitem"
              className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setOpen(false)}
            >
              Account &amp; settings
            </Link>
            <Link
              href="/pricing"
              role="menuitem"
              className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setOpen(false)}
            >
              Plans &amp; billing
            </Link>
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
      ) : null}
    </div>
  );
}
