"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useState, type ReactNode } from "react";
import type { NavSection } from "./types";
import { isNavGroup } from "./types";
import { isLinkActive } from "./matchPath";

export type SidebarProps = {
  appName: string;
  sections: NavSection[];
  footer?: ReactNode;
  collapsed?: boolean;
  className?: string;
};

export function Sidebar({
  appName,
  sections,
  footer,
  collapsed = false,
  className = "",
}: SidebarProps) {
  const pathname = usePathname() ?? "";

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useLayoutEffect(() => {
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

  return (
    <aside
      className={[
        "hidden shrink-0 md:flex md:h-full md:min-h-0 md:max-h-full md:flex-col md:border-r md:border-gray-200 md:bg-white",
        collapsed ? "md:w-[88px]" : "md:w-[260px]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex h-16 shrink-0 items-center border-b border-gray-200 px-4">
        <div className="truncate text-lg font-semibold text-gray-900">
          {collapsed ? "AI" : appName}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <nav className="space-y-2">
          {sections.map((section) => {
            if (!isNavGroup(section)) {
              const active = isLinkActive(pathname, section);
              return (
                <Link
                  key={section.href}
                  href={section.href}
                  className={[
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                    active
                      ? "bg-gray-900 text-white"
                      : "text-gray-700 hover:bg-gray-100",
                  ].join(" ")}
                >
                  {section.icon ? <span className="shrink-0">{section.icon}</span> : null}
                  {!collapsed ? (
                    <>
                      <span className="truncate">{section.label}</span>
                      {section.badge ? (
                        <span className="ml-auto rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
                          {section.badge}
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </Link>
              );
            }

            const isOpen = openGroups[section.label] ?? false;
            const hasActiveChild = section.items.some((item) => isLinkActive(pathname, item));

            return (
              <div key={section.label} className="rounded-2xl">
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups((prev) => ({
                      ...prev,
                      [section.label]: !isOpen,
                    }))
                  }
                  className={[
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition",
                    hasActiveChild
                      ? "bg-gray-50 text-gray-900"
                      : "text-gray-700 hover:bg-gray-50",
                  ].join(" ")}
                >
                  {section.icon ? <span className="shrink-0">{section.icon}</span> : null}
                  {!collapsed ? (
                    <>
                      <span className="flex-1 truncate font-medium">{section.label}</span>
                      <span className="text-xs text-gray-400">{isOpen ? "−" : "+"}</span>
                    </>
                  ) : null}
                </button>

                {!collapsed && isOpen ? (
                  <div className="mt-1 space-y-1 pl-4">
                    {section.items.map((item) => {
                      const active = isLinkActive(pathname, item);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={[
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
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
                ) : null}
              </div>
            );
          })}
        </nav>
      </div>

      {footer ? <div className="shrink-0 border-t border-gray-200 px-3 py-3">{footer}</div> : null}
    </aside>
  );
}
