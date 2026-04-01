import type { NavGroupItem, NavLeafItem, NavSection } from "./types";
import { isNavGroup } from "./types";

function roleMatches(allowed: string[] | undefined, userRole: string): boolean {
  if (!allowed?.length) return true;
  const u = userRole.toLowerCase();
  return allowed.some((r) => r.toLowerCase() === u);
}

function roleHiddenBy(hideFor: string[] | undefined, userRole: string): boolean {
  if (!hideFor?.length) return false;
  const u = userRole.toLowerCase();
  return hideFor.some((r) => r.toLowerCase() === u);
}

/**
 * Drops nav sections the user’s role is not allowed to see.
 * `userRole` is typically `user_profiles.role` (e.g. `admin`, `agent`).
 */
export function filterNavSectionsByRole(
  sections: NavSection[],
  userRole: string | null | undefined
): NavSection[] {
  const r = (userRole ?? "").trim();
  return sections.flatMap((section): NavSection[] => {
    if (isNavGroup(section)) {
      const g = section as NavGroupItem;
      if (!roleMatches(g.roles, r)) return [];
      const items = g.items.filter(
        (leaf: NavLeafItem) =>
          roleMatches(leaf.roles, r) && !roleHiddenBy(leaf.hideForRoles, r)
      );
      if (items.length === 0) return [];
      return [{ ...g, items }];
    }
    const leaf = section as NavLeafItem;
    if (!roleMatches(leaf.roles, r)) return [];
    if (roleHiddenBy(leaf.hideForRoles, r)) return [];
    return [leaf];
  });
}
