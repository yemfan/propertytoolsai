"use client";

import { ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { NavSection } from "./types";
import { isNavDivider, isNavGroup } from "./types";
import { isLinkActive } from "./matchPath";

function cn(...parts: (string | false | undefined | null)[]) {
  return parts.filter(Boolean).join(" ");
}

export type MobileSidebarProps = {
  appName: string;
  sections: NavSection[];
  className?: string;
};

export function MobileSidebar({ appName, sections, className = "" }: MobileSidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "";
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const s of sections) {
      if (isNavGroup(s) && s.defaultOpen) {
        initial[s.label] = true;
      }
    }
    return initial;
  });
  const lastAutoExpandPath = useRef<string | null>(null);
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  useLayoutEffect(() => {
    if (lastAutoExpandPath.current === pathname) return;
    lastAutoExpandPath.current = pathname;
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const section of sectionsRef.current) {
        if (isNavGroup(section)) {
          if (section.items.some((item) => isLinkActive(pathname, item))) {
            next[section.label] = true;
          }
        }
      }
      return next;
    });
  }, [pathname]);

  /**
   * Body scroll lock while the drawer is open. Uses `position: fixed` +
   * captured scroll offset rather than `overflow: hidden` because iOS
   * Safari ignores `overflow: hidden` on <body> for touch scrolling — the
   * background page would still scroll under the open drawer otherwise,
   * which is the most common "the hamburger is broken on iPhone" symptom.
   * Scroll position is captured before the lock and restored on close so
   * the user lands back where they were.
   */
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const prevPosition = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevWidth = document.body.style.width;
    const prevOverflow = document.body.style.overflow;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.position = prevPosition;
      document.body.style.top = prevTop;
      document.body.style.width = prevWidth;
      document.body.style.overflow = prevOverflow;
      window.scrollTo(0, scrollY);
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

  /**
   * The modal is rendered into `document.body` via portal (further down)
   * so it escapes the Topbar `<header>`'s `backdrop-filter` ancestor.
   *
   * CSS spec: any element with `transform`, `filter`, `perspective`, or
   * `backdrop-filter` not equal to `none` becomes the containing block for
   * any descendant `position: fixed` element. Without the portal, our
   * `fixed inset-0` modal would re-anchor to the 60px-tall topbar instead
   * of the viewport, so the drawer panel would only be 60px tall and clip
   * every nav item past the first one. This is the most common "the
   * hamburger drawer only shows one item" symptom on iOS Safari.
   */

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={[
          "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-gray-200/90 bg-white text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 lg:hidden",
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

      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div
            id="mobile-nav-panel"
            className="absolute inset-y-0 left-0 flex w-[86%] max-w-[320px] flex-col overflow-y-auto border-r border-slate-200/80 bg-white p-4 shadow-[8px_0_48px_-12px_rgba(15,23,42,0.2)]"
            style={{
              // iOS Safari: use 100dvh so the address-bar collapse doesn't
              // jump the panel mid-scroll, and pad the bottom for the home
              // indicator so the last item isn't hidden behind it.
              minHeight: "100dvh",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
            }}
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
              {sections.map((section, sectionIdx) => {
                if (isNavDivider(section)) {
                  return (
                    <div
                      key={`nav-divider-${sectionIdx}`}
                      className="my-1 border-t border-slate-200/90 pt-1"
                      role="separator"
                      aria-hidden
                    />
                  );
                }
                if (!isNavGroup(section)) {
                  const active = isLinkActive(pathname, section);
                  return (
                    <Link
                      key={`${section.href}-${section.label}`}
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
                      aria-label={isGroupOpen ? `Collapse ${section.label}` : `Expand ${section.label}`}
                      onClick={() =>
                        setOpenGroups((prev) => ({
                          ...prev,
                          [section.label]: !(prev[section.label] ?? false),
                        }))
                      }
                      className="flex w-full items-center gap-2 rounded-t-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-100/60"
                    >
                      {section.icon ? <span className="shrink-0 text-slate-500">{section.icon}</span> : null}
                      <span className="min-w-0 flex-1 truncate">{section.label}</span>
                      <span
                        className={cn(
                          "shrink-0 text-slate-400 transition-transform duration-200 ease-out",
                          isGroupOpen ? "rotate-0" : "-rotate-90"
                        )}
                        aria-hidden
                      >
                        <ChevronDown className="h-4 w-4" strokeWidth={2} />
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
        </div>,
            document.body
          )
        : null}
    </>
  );
}
