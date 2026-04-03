import type { NavGroupItem, NavLeafItem, NavSection } from "./types";
import { isNavDivider, isNavGroup } from "./types";

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

/** Removes leading/trailing dividers and merges consecutive dividers (e.g. after role filtering). */
function collapseNavDividers(sections: NavSection[]): NavSection[] {
  const out: NavSection[] = [];
  for (const s of sections) {
    if (isNavDivider(s)) {
      if (out.length === 0) continue;
      const last = out[out.length - 1];
      if (isNavDivider(last)) continue;
      out.push(s);
    } else {
      out.push(s);
    }
  }
  while (out.length > 0 && isNavDivider(out[out.length - 1]!)) {
    out.pop();
  }
  return out;
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
  const mapped = sections.flatMap((section): NavSection[] => {
    if (isNavDivider(section)) return [section];
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
  return collapseNavDividers(mapped);
}
