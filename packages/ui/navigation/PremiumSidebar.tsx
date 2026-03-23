"use client";

import { ChevronLeft, ChevronRight, ChevronDown, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useState, type ReactNode } from "react";
import type { NavSection } from "./types";
import { isNavGroup } from "./types";
import { isLinkActive } from "./matchPath";

export type PremiumSidebarProps = {
  appName: string;
  sections: NavSection[];
  footer?: ReactNode;
  /** Shown under the app name when expanded (e.g. nav config `sidebarTitle`). */
  workspaceLabel?: string;
  /** Desktop starts collapsed (icon rail). Default `true`. */
  defaultCollapsed?: boolean;
  /** Tooltip when sidebar is collapsed and a custom footer is shown. */
  footerCollapsedLabel?: string;
  className?: string;
};

function cn(...parts: (string | false | undefined | null)[]) {
  return parts.filter(Boolean).join(" ");
}

/** Stable DOM id for `aria-controls` (no hooks in loops). */
function navGroupPanelId(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `premium-sidebar-group-${slug || "section"}`;
}

const motionSafe = "motion-reduce:transition-none motion-reduce:duration-0";
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

/**
 * Tooltip for collapsed rail: smooth fade, high z-index, subtle arrow.
 * Also sets native `title` for accessibility when collapsed.
 */
function RailTooltip({
  children,
  label,
  collapsed,
}: {
  children: ReactNode;
  label: string;
  collapsed: boolean;
}) {
  if (!collapsed) return <>{children}</>;

  return (
    <div className="group/tooltip relative flex w-full justify-center">
      {children}
      <div
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-full top-1/2 z-[200] ml-3 -translate-y-1/2",
          "rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-xl shadow-slate-900/20",
          "opacity-0 transition-all duration-200 ease-out motion-reduce:transition-none",
          "before:absolute before:right-full before:top-1/2 before:mr-px before:-translate-y-1/2",
          "before:border-[6px] before:border-transparent before:border-r-slate-900",
          "group-hover/tooltip:opacity-100 group-hover/tooltip:delay-100 motion-reduce:group-hover/tooltip:delay-0"
        )}
      >
        {label}
      </div>
    </div>
  );
}

function NavIconWrap({
  collapsed,
  active,
  children,
}: {
  collapsed: boolean;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center text-current transition-transform duration-200 ease-out",
        "[&_svg]:shrink-0",
        collapsed ? "h-10 w-10 rounded-xl" : "h-5 w-5 rounded-lg",
        collapsed && active && "bg-white/15 text-white",
        collapsed && !active && "text-slate-600 group-hover/link:bg-slate-100 group-hover/nav:bg-slate-100"
      )}
    >
      {children}
    </span>
  );
}

/**
 * Premium collapsible desktop sidebar: default-collapsed icon rail, hover tooltips,
 * animated groups, and shared active logic for PropertyToolsAI / LeadSmart-style nav configs.
 */
export function PremiumSidebar({
  appName,
  sections,
  footer,
  workspaceLabel = "Workspace",
  defaultCollapsed = true,
  footerCollapsedLabel = "Quick tip",
  className = "",
}: PremiumSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
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

  const initial = appName.trim().charAt(0).toUpperCase() || "A";

  return (
    <aside
      className={cn(
        "hidden md:flex md:h-screen md:shrink-0 md:flex-col md:overflow-hidden",
        "border-r border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50/95",
        "shadow-[4px_0_32px_-12px_rgba(15,23,42,0.12)]",
        "transition-[width] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]",
        motionSafe,
        collapsed ? "md:w-[76px]" : "md:w-[280px]",
        className
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "shrink-0 border-b border-slate-200/70",
          collapsed ? "flex flex-col items-center gap-2 py-3" : "flex h-[60px] items-center gap-2 px-3"
        )}
      >
        {collapsed ? (
          <>
            <RailTooltip label={appName} collapsed>
              <div
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold tracking-tight text-white shadow-md shadow-slate-900/25"
                aria-hidden
              >
                {initial}
              </div>
            </RailTooltip>
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-500 shadow-sm",
                "transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800",
                motionSafe,
                focusRing
              )}
              aria-expanded={false}
              aria-label="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
          </>
        ) : (
          <>
            <div className="min-w-0 flex-1 px-1">
              <p className="truncate text-[15px] font-semibold tracking-tight text-slate-900">{appName}</p>
              <p className="truncate text-[11px] font-medium uppercase tracking-wider text-slate-400">{workspaceLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-500 shadow-sm",
                "transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800",
                motionSafe,
                focusRing
              )}
              aria-expanded
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
          </>
        )}
      </div>

      {/* Nav */}
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-3 [scrollbar-gutter:stable]">
        <nav className="space-y-1">
          {sections.map((section) => {
            if (!isNavGroup(section)) {
              const active = isLinkActive(pathname, section);
              const link = (
                <Link
                  href={section.href}
                  title={collapsed ? section.label : undefined}
                  className={cn(
                    "group/link flex items-center rounded-2xl transition-all duration-200 ease-out",
                    motionSafe,
                    focusRing,
                    collapsed ? "justify-center px-0 py-0.5" : "gap-3 px-3 py-2.5",
                    active
                      ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                      : "text-slate-600 hover:bg-slate-100/90 hover:text-slate-900"
                  )}
                >
                  <NavIconWrap collapsed={collapsed} active={active}>
                    {section.icon ?? <span className="text-xs opacity-70">•</span>}
                  </NavIconWrap>
                  {!collapsed ? (
                    <>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{section.label}</span>
                      {section.badge ? (
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                            active ? "bg-white/20 text-white" : "bg-slate-200/90 text-slate-700"
                          )}
                        >
                          {section.badge}
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </Link>
              );

              return (
                <RailTooltip key={section.href} label={section.label} collapsed={collapsed}>
                  {link}
                </RailTooltip>
              );
            }

            const isOpen = openGroups[section.label] ?? false;
            const hasActiveChild = section.items.some((item) => isLinkActive(pathname, item));
            const groupPanelId = navGroupPanelId(section.label);

            const groupBtn = (
              <button
                type="button"
                id={`${groupPanelId}-trigger`}
                title={collapsed ? `${section.label} — click to expand sidebar` : undefined}
                aria-expanded={!collapsed && isOpen}
                aria-controls={groupPanelId}
                onClick={() =>
                  collapsed
                    ? setCollapsed(false)
                    : setOpenGroups((prev) => ({
                        ...prev,
                        [section.label]: !isOpen,
                      }))
                }
                className={cn(
                  "group/nav flex w-full items-center rounded-2xl text-left transition-all duration-200 ease-out",
                  motionSafe,
                  focusRing,
                  collapsed ? "justify-center px-0 py-0.5" : "gap-2 px-3 py-2.5",
                  hasActiveChild
                    ? "bg-slate-100/90 text-slate-900"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                )}
              >
                <NavIconWrap collapsed={collapsed} active={hasActiveChild && collapsed}>
                  {section.icon ?? <span className="text-xs opacity-70">•</span>}
                </NavIconWrap>
                {!collapsed ? (
                  <>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{section.label}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 ease-out",
                        isOpen && "rotate-180"
                      )}
                      strokeWidth={2}
                      aria-hidden
                    />
                  </>
                ) : null}
              </button>
            );

            return (
              <div key={section.label} className="space-y-0.5">
                <RailTooltip label={section.label} collapsed={collapsed}>
                  {groupBtn}
                </RailTooltip>

                {!collapsed ? (
                  <div
                    id={groupPanelId}
                    role="region"
                    aria-labelledby={`${groupPanelId}-trigger`}
                    className={cn(
                      "grid overflow-hidden transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]",
                      motionSafe,
                      isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    )}
                  >
                    <div className="min-h-0">
                      <div className="ml-3 space-y-0.5 border-l border-slate-200/80 py-1 pl-3">
                        {section.items.map((item) => {
                          const active = isLinkActive(pathname, item);
                          return (
                            <Link
                              key={`${item.href}::${item.label}`}
                              href={item.href}
                              className={cn(
                                "group/sublink flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-all duration-200",
                                motionSafe,
                                focusRing,
                                active
                                  ? "bg-slate-900 font-medium text-white shadow-sm shadow-slate-900/15"
                                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                              )}
                            >
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center text-current [&_svg]:size-3.5">
                                {item.icon ?? <span className="text-[10px] opacity-60">•</span>}
                              </span>
                              <span className="min-w-0 flex-1 truncate">{item.label}</span>
                              {item.badge ? (
                                <span
                                  className={cn(
                                    "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                                    active ? "bg-white/20 text-white" : "bg-slate-200/90 text-slate-600"
                                  )}
                                >
                                  {item.badge}
                                </span>
                              ) : null}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </div>

      {footer ? (
        <div className="shrink-0 border-t border-slate-200/70 p-2">
          {collapsed ? (
            <RailTooltip label={footerCollapsedLabel} collapsed={collapsed}>
              <div className="flex justify-center py-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-md shadow-slate-900/25">
                  <Sparkles className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                </div>
              </div>
            </RailTooltip>
          ) : (
            <div className="transition-opacity duration-200">{footer}</div>
          )}
        </div>
      ) : null}
    </aside>
  );
}
