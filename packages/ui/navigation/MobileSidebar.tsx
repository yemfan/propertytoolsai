"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
          "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-800 shadow-sm hover:bg-gray-50 md:hidden",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
      >
        <span className="text-lg leading-none" aria-hidden>
          ☰
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div
            id="mobile-nav-panel"
            className="absolute left-0 top-0 flex h-full w-[86%] max-w-[320px] flex-col overflow-y-auto bg-white p-4 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="truncate text-lg font-semibold text-gray-900">{appName}</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                aria-label="Close menu"
              >
                ✕
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
                      onClick={() => setOpen(false)}
                      className={[
                        "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition",
                        active ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100",
                      ].join(" ")}
                    >
                      {section.icon ? <span className="shrink-0">{section.icon}</span> : null}
                      <span className="truncate">{section.label}</span>
                      {section.badge ? (
                        <span
                          className={[
                            "ml-auto rounded-full px-2 py-0.5 text-xs",
                            active ? "bg-white/15 text-white" : "bg-gray-200 text-gray-700",
                          ].join(" ")}
                        >
                          {section.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                }

                return (
                  <div key={section.label} className="rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-gray-900">
                      {section.icon ? <span className="shrink-0 text-gray-500">{section.icon}</span> : null}
                      <span className="truncate">{section.label}</span>
                    </div>
                    <div className="space-y-1 px-2 pb-2">
                      {section.items.map((item) => {
                        const active = isLinkActive(pathname, item);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={[
                              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                              active
                                ? "bg-gray-900 text-white"
                                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                            ].join(" ")}
                          >
                            {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
                            <span className="truncate">{item.label}</span>
                            {item.badge ? (
                              <span
                                className={[
                                  "ml-auto rounded-full px-2 py-0.5 text-xs",
                                  active ? "bg-white/15 text-white" : "bg-gray-200 text-gray-700",
                                ].join(" ")}
                              >
                                {item.badge}
                              </span>
                            ) : null}
                          </Link>
                        );
                      })}
                    </div>
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
