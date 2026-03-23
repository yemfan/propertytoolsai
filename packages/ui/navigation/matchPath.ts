import type { NavGroupItem, NavLeafItem, NavSection } from "./types";
import { isNavGroup } from "./types";

export function isLinkActive(pathname: string | null, link: NavLeafItem): boolean {
  if (!pathname) return false;
  if (link.match?.length) {
    return link.match.some((p) => pathname === p || pathname === `${p}/`);
  }
  return (
    pathname === link.href ||
    (link.href !== "/" && pathname.startsWith(`${link.href}/`))
  );
}

export function isGroupActive(pathname: string | null, group: NavGroupItem): boolean {
  return group.items.some((item) => isLinkActive(pathname, item));
}

export function isSectionActive(pathname: string | null, section: NavSection): boolean {
  if (isNavGroup(section)) return isGroupActive(pathname, section);
  return isLinkActive(pathname, section);
}
