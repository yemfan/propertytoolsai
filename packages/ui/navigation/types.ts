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
   * When set, only users whose `user_profiles.role` matches one of these strings (case-insensitive)
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
};

export type NavSection = NavLeafItem | NavGroupItem;

export function isNavGroup(item: NavSection): item is NavGroupItem {
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
