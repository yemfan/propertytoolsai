import Link from "next/link";
import type { ReactNode } from "react";
import {
  CalendarDays,
  ExternalLink,
  LayoutDashboard,
  MessageCircle,
  PenLine,
  Sparkles,
  Users,
} from "lucide-react";

/**
 * Shell for /demo/* pages — recreates the dashboard chrome (sidebar
 * + header banner + main column) without touching the real
 * authenticated layout. Everything inside is static; the persistent
 * banner makes the read-only nature unmistakable.
 */

type Item = {
  href: string;
  label: string;
  icon: ReactNode;
  match?: string;
};

const DEMO_NAV: Item[] = [
  { href: "/demo", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/demo/inbox", label: "Inbox", icon: <MessageCircle className="h-4 w-4" /> },
  { href: "/demo/contacts", label: "Contacts", icon: <Users className="h-4 w-4" /> },
  { href: "/demo/drafts", label: "AI Drafts", icon: <PenLine className="h-4 w-4" /> },
  { href: "/demo/calendar", label: "Calendar", icon: <CalendarDays className="h-4 w-4" /> },
];

export function DemoShell({
  active,
  children,
}: {
  /** Current /demo/* path so the sidebar highlights the right item. */
  active: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <SandboxBanner />

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 md:px-6 md:py-8">
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 md:block">
          <div className="sticky top-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Demo workspace
            </p>
            <p className="mt-1 px-2 text-sm font-semibold text-slate-900 dark:text-white">
              Sandbox · Read-only
            </p>
            <nav className="mt-4 space-y-1">
              {DEMO_NAV.map((item) => {
                const isActive = active === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                      isActive
                        ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-6 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-3 dark:border-blue-900/40 dark:from-blue-950/30 dark:to-slate-900">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                <Sparkles className="h-3 w-3" aria-hidden />
                Ready to use this for real?
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-700 dark:text-slate-300">
                Start a 14-day free trial — your real workspace, no credit card.
              </p>
              <Link
                href="/start-free"
                className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                Start free trial
              </Link>
            </div>
          </div>
        </aside>

        {/* Main column */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function SandboxBanner() {
  return (
    <div className="sticky top-0 z-30 border-b border-amber-300 bg-amber-50 px-4 py-2.5 dark:border-amber-900/60 dark:bg-amber-950/40">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 md:px-2">
        <p className="text-xs font-medium text-amber-900 dark:text-amber-200 sm:text-sm">
          <span className="font-bold">Sandbox mode.</span> You&apos;re looking
          at fake data — buttons that send messages, create deals, or
          change settings are disabled. Click freely.
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="/start-free"
            className="inline-flex items-center justify-center rounded-md bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-950 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
          >
            Start free trial
          </Link>
          <Link
            href="/try-demo"
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900 underline-offset-2 transition hover:underline dark:text-amber-200"
          >
            About this demo
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Pill button for any "action" inside a demo screen that would
 * normally mutate state. Renders an inert button that surfaces a
 * tooltip-style note via the title attribute and the visible suffix.
 */
export function DemoDisabledButton({
  label,
  variant = "primary",
}: {
  label: string;
  variant?: "primary" | "ghost";
}) {
  const styles =
    variant === "primary"
      ? "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500"
      : "border border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500";
  return (
    <button
      type="button"
      disabled
      title="Disabled in sandbox mode. Start a free trial to use this for real."
      className={`inline-flex cursor-not-allowed items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${styles}`}
    >
      {label}
      <span className="text-[9px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
        Demo
      </span>
    </button>
  );
}
