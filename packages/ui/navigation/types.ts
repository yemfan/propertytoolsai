import type { ReactNode } from "react";

/**
 * Shared nav primitives for `PremiumSidebar`, `MobileSidebar`, `Topbar`, etc.
 * Apps build `NavSection[]` in `nav.config.tsx` (see `apps/property-tools`, `apps/leadsmart-ai`).
 */
export type NavLeafItem = {
  label: string;
  href: string;
  icon?: ReactNode;
  badge?: string;
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
