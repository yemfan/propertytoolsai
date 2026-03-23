"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { NavSection } from "./types";
import { isNavGroup } from "./types";
import { isLinkActive } from "./matchPath";

export type MobileSidebarProps = {
  appName: string;
  sections: NavSection[];
  className?: string;
};

export function MobileSidebar({ appName, sections, className = "" }: MobileSidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "";
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const lastAutoExpandPath = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (lastAutoExpandPath.current === pathname) return;
    lastAutoExpandPath.current = pathname;
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const section of sections) {
        if (isNavGroup(section)) {
          if (section.items.some((item) => isLinkActive(pathname, item))) {
            next[section.label] = true;
          }
        }
      }
      return next;
    });
  }, [pathname, sections]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={[
          "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-gray-200/90 bg-white text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 md:hidden",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
      >
        <Menu className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div
            id="mobile-nav-panel"
            className="absolute left-0 top-0 flex h-full w-[86%] max-w-[320px] flex-col overflow-y-auto border-r border-slate-200/80 bg-white/95 p-4 shadow-[8px_0_48px_-12px_rgba(15,23,42,0.2)] backdrop-blur-xl"
          >
            <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Menu</div>
                <div className="truncate text-lg font-semibold tracking-tight text-slate-900">{appName}</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                aria-label="Close menu"
              >
                <X className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
              </button>
            </div>

            <nav className="space-y-2">
              {sections.map((section) => {
                if (!isNavGroup(section)) {
                  const active = isLinkActive(pathname, section);
                  return (
                    <Link
                      key={section.href}
                      href={section.href}
                      prefetch={section.prefetch === false ? false : undefined}
                      onClick={() => setOpen(false)}
                      className={[
                        "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                        active ? "bg-slate-900 text-white shadow-sm" : "text-slate-700 hover:bg-slate-100",
                      ].join(" ")}
                    >
                      {section.icon ? <span className="shrink-0">{section.icon}</span> : null}
                      <span className="truncate">{section.label}</span>
                      {section.badge ? (
                        <span
                          className={[
                            "ml-auto rounded-full px-2 py-0.5 text-xs",
                            active ? "bg-white/15 text-white" : "bg-slate-200/90 text-slate-700",
                          ].join(" ")}
                        >
                          {section.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                }

                const isGroupOpen = openGroups[section.label] ?? false;
                return (
                  <div key={section.label} className="rounded-xl border border-slate-100/90 bg-slate-50/40">
                    <button
                      type="button"
                      aria-expanded={isGroupOpen}
                      onClick={() =>
                        setOpenGroups((prev) => ({
                          ...prev,
                          [section.label]: !isGroupOpen,
                        }))
                      }
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-100/60 rounded-t-xl"
                    >
                      {section.icon ? <span className="shrink-0 text-slate-500">{section.icon}</span> : null}
                      <span className="min-w-0 flex-1 truncate">{section.label}</span>
                      <span className="shrink-0 text-xs font-medium text-slate-400 tabular-nums" aria-hidden>
                        {isGroupOpen ? "−" : "+"}
                      </span>
                    </button>
                    {isGroupOpen ? (
                      <div className="space-y-1 px-2 pb-2">
                        {section.items.map((item) => {
                          const active = isLinkActive(pathname, item);
                          return (
                            <Link
                              key={`${item.href}::${item.label}`}
                              href={item.href}
                              prefetch={item.prefetch === false ? false : undefined}
                              onClick={() => setOpen(false)}
                              className={[
                                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
                                active
                                  ? "bg-slate-900 text-white shadow-sm"
                                  : "text-slate-600 hover:bg-white hover:text-slate-900",
                              ].join(" ")}
                            >
                              {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
                              <span className="truncate">{item.label}</span>
                              {item.badge ? (
                                <span
                                  className={[
                                    "ml-auto rounded-full px-2 py-0.5 text-xs",
                                    active ? "bg-white/15 text-white" : "bg-slate-200/90 text-slate-700",
                                  ].join(" ")}
                                >
                                  {item.badge}
                                </span>
                              ) : null}
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
