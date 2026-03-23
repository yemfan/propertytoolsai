"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useState } from "react";

export type CollapsibleNavGroupProps = {
  title: string;
  titleIcon?: ReactNode;
  active: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
  variant?: "consumer" | "agent";
};

export function CollapsibleNavGroup({
  title,
  titleIcon,
  active,
  defaultOpen = false,
  children,
  variant = "consumer",
}: CollapsibleNavGroupProps) {
  const panelId = useId();
  const [open, setOpen] = useState(defaultOpen || active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  const shell =
    variant === "agent"
      ? "rounded-lg border border-slate-200/80 bg-slate-50/80"
      : "rounded-lg border border-slate-100 bg-slate-50/50";

  return (
    <div className={shell}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex min-w-0 items-center gap-2">
          {titleIcon ? <span className="shrink-0 text-slate-400 [&>svg]:h-3.5 [&>svg]:w-3.5">{titleIcon}</span> : null}
          <span className="truncate">{title}</span>
        </span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open ? (
        <div id={panelId} className="space-y-0.5 px-1 pb-2">
          {children}
        </div>
      ) : null}
    </div>
  );
}
