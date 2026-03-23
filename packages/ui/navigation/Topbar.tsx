"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { MobileSidebar } from "./MobileSidebar";
import type { NavSection } from "./types";

export type TopbarAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "outline" | "ghost";
  disabled?: boolean;
  className?: string;
};

export type TopbarProps = {
  appName: string;
  sections: NavSection[];
  searchPlaceholder?: string;
  rightActions?: TopbarAction[];
  /** Shown after {@link MobileSidebar}, before search (e.g. logo or brand). */
  leadingExtra?: ReactNode;
  /** Replaces the default text search input when provided. */
  searchSlot?: ReactNode;
  /** Extra controls on the right (icons, menus); shown after `rightActions`. */
  trailing?: ReactNode;
  /** Second row under the bar (e.g. mobile-only search). */
  below?: ReactNode;
  className?: string;
};

function actionClasses(action: TopbarAction): string {
  const base = [
    "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
    action.variant === "outline"
      ? "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
      : action.variant === "ghost"
        ? "text-gray-600 hover:bg-gray-100"
        : "bg-gray-900 text-white hover:bg-gray-800",
  ].join(" ");
  return [base, action.className].filter(Boolean).join(" ");
}

function ActionButton({ action }: { action: TopbarAction }) {
  const className = actionClasses(action);

  if (action.href) {
    const h = action.href;
    if (/^https?:\/\//i.test(h)) {
      return (
        <a href={h} className={className}>
          {action.label}
        </a>
      );
    }
    return (
      <Link href={h} className={className}>
        {action.label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={action.onClick} disabled={action.disabled} className={className}>
      {action.label}
    </button>
  );
}

/**
 * Sticky top bar with {@link MobileSidebar}, optional `leadingExtra`, search, and actions.
 */
export function Topbar({
  appName,
  sections,
  searchPlaceholder = "Search...",
  rightActions = [],
  leadingExtra,
  searchSlot,
  trailing,
  below,
  className = "",
}: TopbarProps) {
  return (
    <header
      className={`sticky top-0 z-40 border-b border-gray-200/80 bg-white/90 backdrop-blur ${className}`}
    >
      <div className="flex h-16 items-center gap-3 px-4 md:px-6">
        <MobileSidebar appName={appName} sections={sections} />

        {leadingExtra ? <div className="min-w-0 shrink-0">{leadingExtra}</div> : null}

        <div className="min-w-0 flex-1">
          {searchSlot ?? (
            <input
              type="search"
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none ring-0 placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
            />
          )}
        </div>

        <div className="flex max-w-[45vw] shrink-0 items-center gap-1.5 overflow-x-auto sm:max-w-none sm:gap-2 md:max-w-none">
          {rightActions.map((action, i) => (
            <ActionButton key={`${action.label}-${i}`} action={action} />
          ))}
          {trailing}
        </div>
      </div>

      {below ? <div className="border-t border-gray-100 px-4 py-2 md:px-6">{below}</div> : null}
    </header>
  );
}
