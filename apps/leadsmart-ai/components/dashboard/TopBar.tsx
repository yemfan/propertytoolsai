"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Topbar } from "@repo/ui";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { leadSmartNav } from "@/nav.config";

function ProfileMenu({
  email,
  onLogout,
}: {
  email: string | null | undefined;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const initial = email?.trim()?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white pl-1 pr-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800">
          {initial}
        </span>
        <span className="hidden max-w-[8rem] truncate sm:inline">Profile</span>
        <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-slate-900/5"
          role="menu"
        >
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Signed in</p>
            <p className="truncate text-sm font-medium text-slate-900">{email || "Account"}</p>
          </div>
          <Link
            href="/dashboard/settings"
            className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          <Link
            href="/pricing"
            className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Billing &amp; credits
          </Link>
          <div className="border-t border-slate-100 py-1">
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
            >
              Log out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function TopBar({ email }: { email: string | null | undefined }) {
  const router = useRouter();
  const [tokens, setTokens] = useState<number | null>(null);
  const [plan, setPlan] = useState<string | null>(null);

  async function onLogout() {
    try {
      await supabaseBrowser().auth.signOut();
    } catch (e) {
      console.error("Logout failed", e);
    } finally {
      router.push("/login?redirect=/dashboard");
      router.refresh?.();
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = supabaseBrowser();
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        const res = await fetch("/api/me", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (cancelled) return;
        setTokens(typeof json?.tokens_remaining === "number" ? json.tokens_remaining : null);
        setPlan(typeof json?.plan === "string" ? json.plan : null);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const q = String(fd.get("q") ?? "").trim();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    router.push(`/dashboard/leads${params.toString() ? `?${params}` : ""}`);
  }

  const search = (
    <form onSubmit={onSearch} className="relative w-full max-w-xl" role="search">
      <label htmlFor="ls-dashboard-search" className="sr-only">
        Search leads
      </label>
      <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <input
        id="ls-dashboard-search"
        name="q"
        type="search"
        placeholder="Search leads, clients, addresses..."
        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
    </form>
  );

  return (
    <Topbar
      className="z-20 border-slate-200 bg-white/95"
      appName="LeadSmart AI"
      sections={leadSmartNav}
      searchPlaceholder="Search leads, clients, addresses..."
      leadingExtra={
        <div className="hidden min-w-0 flex-col md:flex md:max-w-[11rem]">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">LeadSmart AI</span>
          <span className="truncate text-sm font-semibold text-slate-900">Command center</span>
        </div>
      }
      searchSlot={search}
      rightActions={[
        { label: "Notifications", href: "/dashboard/notifications", variant: "ghost" },
        { label: "Billing", href: "/settings/billing", variant: "outline" },
        { label: "Upgrade", href: "/pricing" },
      ]}
      trailing={
        <>
          <Link
            href="/pricing"
            title="Billing and credits"
            className="flex h-9 min-w-[2.25rem] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 sm:hidden"
          >
            <span className="tabular-nums">{typeof tokens === "number" ? tokens : "—"}</span>
          </Link>

          <Link
            href="/pricing"
            className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 sm:flex"
          >
            <span className="text-slate-500">Credits</span>
            <span className="tabular-nums text-slate-900">
              {typeof tokens === "number" ? tokens : "—"}
            </span>
            {plan ? <span className="text-slate-400">· {plan}</span> : null}
          </Link>

          <ProfileMenu email={email} onLogout={onLogout} />
        </>
      }
    />
  );
}
