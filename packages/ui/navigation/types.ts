import type { ReactNode } from "react";

/**
 * Shared nav primitives for `PremiumSidebar`, `MobileSidebar`, `Topbar`, etc.
 * Apps build `NavSection[]` in `nav.config.tsx` (see `apps/propertytoolsai`, `apps/leadsmartai`).
 */
export type NavLeafItem = {
  label: string;
  href: string;
  icon?: ReactNode;
  badge?: string;
  /**
   * When set, only users whose `leadsmart_users.role` matches one of these strings (case-insensitive)
   * see this item. Omit for all authenticated users.
   */
  roles?: string[];
  /**
   * When set, users whose role matches one of these strings do not see this item (e.g. hide CRM
   * “Billing” from platform admin/support).
   */
  hideForRoles?: string[];
  /**
   * When set, active only on these pathnames (exact, optional trailing slash).
   * Use for roots like `/dashboard` so `/dashboard/leads` does not match.
   */
  match?: string[];
  /** Pass `false` to avoid Next.js prefetch (e.g. dashboard entry from marketing shell). */
  prefetch?: boolean;
};

/** Horizontal rule between nav groups (sidebar / mobile drawer). */
export type NavDividerSection = {
  kind: "divider";
};

/**
 * Supercategory band — a short uppercase label that introduces a cluster
 * of groups (e.g. "WORK", "ENGAGE", "MANAGE"). Non-interactive. Rendered
 * by `PremiumSidebarV2` and the mobile drawer; the legacy `PremiumSidebar`
 * renders nothing for these rows.
 */
export type NavSectionLabel = {
  kind: "section-label";
  label: string;
};

export type NavGroupItem = {
  label: string;
  icon?: ReactNode;
  items: NavLeafItem[];
  /**
   * When set, only users whose role matches one of these strings see the whole group.
   * Child items may still declare their own `roles` for finer control.
   */
  roles?: string[];
  /**
   * Initial expanded state before any user toggle. Active-route auto-expand still applies.
   * Omit or `false` → start collapsed (until user opens or a child route matches).
   */
  defaultOpen?: boolean;
  /**
   * Optional badge shown on the group row itself (count of children-in-flight, etc.).
   * Rendered by `PremiumSidebarV2`; ignored by the legacy `PremiumSidebar`.
   */
  badge?: string;
};

export type NavSection =
  | NavLeafItem
  | NavGroupItem
  | NavDividerSection
  | NavSectionLabel;

export function isNavDivider(item: NavSection): item is NavDividerSection {
  return (item as NavDividerSection).kind === "divider";
}

export function isNavSectionLabel(item: NavSection): item is NavSectionLabel {
  return (item as NavSectionLabel).kind === "section-label";
}

export function isNavGroup(item: NavSection): item is NavGroupItem {
  if (isNavDivider(item)) return false;
  if (isNavSectionLabel(item)) return false;
  return "items" in item && Array.isArray((item as NavGroupItem).items);
}

export type NavConfig = {
  id: string;
  sidebarTitle?: string;
  sections: NavSection[];
};

/** @deprecated use {@link NavConfig} */
export type AppNavConfig = NavConfig;

/** @deprecated use {@link NavLeafItem} */
export type NavLinkDef = NavLeafItem;
/** @deprecated use {@link NavGroupItem} */
export type NavGroupDef = NavGroupItem;
