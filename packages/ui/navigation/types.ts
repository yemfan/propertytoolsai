import type { ReactNode } from "react";

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
