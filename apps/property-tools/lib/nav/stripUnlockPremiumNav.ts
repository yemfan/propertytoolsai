import type { NavSection } from "@repo/ui";
import { isNavGroup } from "@repo/ui";

const UNLOCK_PREMIUM_LABEL = "Unlock Premium";

/**
 * Removes the marketing "Unlock Premium → /pricing" leaf from nav groups when the user
 * is already on a Premium (or Elite) plan.
 */
export function stripUnlockPremiumNavItem(sections: NavSection[]): NavSection[] {
  return sections.map((section) => {
    if (!isNavGroup(section)) return section;
    const items = section.items.filter(
      (item) => !(item.href === "/pricing" && item.label.trim() === UNLOCK_PREMIUM_LABEL)
    );
    if (items.length === section.items.length) return section;
    return { ...section, items };
  });
}
