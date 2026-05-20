/**
 * Sidebar-preview transform: takes the live `leadSmartNav` and produces
 * the V2 shape used by `PremiumSidebarV2`:
 *   - emoji icons → lucide icons (one family, one stroke)
 *   - flat group list → four supercategories (Work / Engage / Analyze / Manage)
 *   - "Home" pinned above the first supercategory
 *   - a handful of demo badges so the count / label / dot styles render
 *
 * Pure presentation; never mutates the source nav. Keeping this in the
 * preview route (not in `@repo/ui`) means the V2 component stays
 * presentation-only and the icon mapping lives next to the LeadSmart
 * vocabulary.
 */

import {
  type NavGroupItem,
  type NavLeafItem,
  type NavSection,
  type NavSectionV2,
  isNavDivider,
  isNavGroup,
} from "@repo/ui";
import {
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Compass,
  CreditCard,
  DoorOpen,
  Eye,
  FileSignature,
  Gem,
  Headphones,
  House,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  Megaphone,
  MessageCircle,
  PenLine,
  PhoneMissed,
  Presentation,
  Rocket,
  Route,
  Ruler,
  Settings,
  ShoppingBag,
  Sparkles,
  Tag,
  Target,
  TrendingUp,
  User,
  Users,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";

function icon(node: ReactNode): ReactNode {
  return node;
}

/** Label → lucide node. 17px for group rows, 14px for leaves. */
const PARENT_ICONS: Record<string, ReactNode> = {
  Home: icon(<LayoutDashboard size={17} strokeWidth={1.75} aria-hidden />),
  Leads: icon(<Users size={17} strokeWidth={1.75} aria-hidden />),
  Buyers: icon(<ShoppingBag size={17} strokeWidth={1.75} aria-hidden />),
  Sellers: icon(<Tag size={17} strokeWidth={1.75} aria-hidden />),
  Transactions: icon(<KeyRound size={17} strokeWidth={1.75} aria-hidden />),
  Communicate: icon(<MessageCircle size={17} strokeWidth={1.75} aria-hidden />),
  Workflow: icon(<Wrench size={17} strokeWidth={1.75} aria-hidden />),
  Insights: icon(<TrendingUp size={17} strokeWidth={1.75} aria-hidden />),
  "Property Tools": icon(<Building2 size={17} strokeWidth={1.75} aria-hidden />),
  Account: icon(<Settings size={17} strokeWidth={1.75} aria-hidden />),
  Admin: icon(<LayoutDashboard size={17} strokeWidth={1.75} aria-hidden />),
};

const LEAF_ICONS: Record<string, ReactNode> = {
  Contacts: icon(<Users size={14} strokeWidth={1.75} aria-hidden />),
  Tasks: icon(<CheckCircle2 size={14} strokeWidth={1.75} aria-hidden />),
  Calendar: icon(<Calendar size={14} strokeWidth={1.75} aria-hidden />),
  "Open Houses": icon(<DoorOpen size={14} strokeWidth={1.75} aria-hidden />),
  "Lead Queue": icon(<ClipboardList size={14} strokeWidth={1.75} aria-hidden />),
  "Generate Leads": icon(<Sparkles size={14} strokeWidth={1.75} aria-hidden />),
  Showings: icon(<Eye size={14} strokeWidth={1.75} aria-hidden />),
  Offers: icon(<FileSignature size={14} strokeWidth={1.75} aria-hidden />),
  Listings: icon(<House size={14} strokeWidth={1.75} aria-hidden />),
  Presentations: icon(<Presentation size={14} strokeWidth={1.75} aria-hidden />),
  "All deals": icon(<KeyRound size={14} strokeWidth={1.75} aria-hidden />),
  Coordinator: icon(<LayoutGrid size={14} strokeWidth={1.75} aria-hidden />),
  Conversations: icon(<MessageCircle size={14} strokeWidth={1.75} aria-hidden />),
  "Missed-call text-back": icon(<PhoneMissed size={14} strokeWidth={1.75} aria-hidden />),
  Drafts: icon(<PenLine size={14} strokeWidth={1.75} aria-hidden />),
  Templates: icon(<ClipboardList size={14} strokeWidth={1.75} aria-hidden />),
  "Marketing Plans": icon(<Megaphone size={14} strokeWidth={1.75} aria-hidden />),
  "Sales Model": icon(<Target size={14} strokeWidth={1.75} aria-hidden />),
  Playbooks: icon(<ClipboardList size={14} strokeWidth={1.75} aria-hidden />),
  Performance: icon(<BarChart3 size={14} strokeWidth={1.75} aria-hidden />),
  Coaching: icon(<Compass size={14} strokeWidth={1.75} aria-hidden />),
  "Sphere monetization": icon(<Gem size={14} strokeWidth={1.75} aria-hidden />),
  "Growth & Opportunities": icon(<Rocket size={14} strokeWidth={1.75} aria-hidden />),
  "All tools": icon(<Wrench size={14} strokeWidth={1.75} aria-hidden />),
  CMAs: icon(<Ruler size={14} strokeWidth={1.75} aria-hidden />),
  Settings: icon(<Settings size={14} strokeWidth={1.75} aria-hidden />),
  Billing: icon(<CreditCard size={14} strokeWidth={1.75} aria-hidden />),
  Profile: icon(<User size={14} strokeWidth={1.75} aria-hidden />),
  Support: icon(<Headphones size={14} strokeWidth={1.75} aria-hidden />),
  "Platform Overview": icon(<LayoutDashboard size={14} strokeWidth={1.75} aria-hidden />),
  Analytics: icon(<BarChart3 size={14} strokeWidth={1.75} aria-hidden />),
  "Support Inbox": icon(<Headphones size={14} strokeWidth={1.75} aria-hidden />),
  "Lead Routing": icon(<Route size={14} strokeWidth={1.75} aria-hidden />),
};

/** Demo badges sprinkled across the preview to showcase the three variants. */
const DEMO_LEAF_BADGES: Record<string, string> = {
  "Lead Queue": "12",
  "Generate Leads": "NEW",
  Offers: "3",
  Conversations: "24",
  "All deals": "8",
};

const DEMO_GROUP_BADGES: Record<string, string> = {
  Admin: "•",
};

function reIcon(section: NavSection): NavSection {
  if (isNavDivider(section)) return section;
  if (isNavGroup(section)) {
    const next: NavGroupItem = {
      ...section,
      icon: PARENT_ICONS[section.label] ?? section.icon,
      badge: DEMO_GROUP_BADGES[section.label] ?? section.badge,
      items: section.items.map((item) => ({
        ...item,
        icon: LEAF_ICONS[item.label] ?? item.icon,
        badge: DEMO_LEAF_BADGES[item.label] ?? item.badge,
      })),
    };
    return next;
  }
  const leaf: NavLeafItem = {
    ...section,
    icon: PARENT_ICONS[section.label] ?? section.icon,
    badge: DEMO_LEAF_BADGES[section.label] ?? section.badge,
  };
  return leaf;
}

const SUPERCATEGORIES: { label: string; groups: string[] }[] = [
  { label: "Work", groups: ["Leads", "Buyers", "Sellers", "Transactions"] },
  { label: "Engage", groups: ["Communicate", "Workflow"] },
  { label: "Analyze", groups: ["Insights", "Property Tools"] },
  { label: "Manage", groups: ["Account", "Admin"] },
];

export function buildPreviewNav(source: NavSection[]): NavSectionV2[] {
  const mapped = source.map(reIcon);

  // Lift "Home" out so it can sit above the first supercategory.
  const home = mapped.find(
    (s): s is NavLeafItem =>
      !isNavDivider(s) && !isNavGroup(s) && s.label === "Home"
  );

  const groupsByLabel = new Map<string, NavGroupItem>();
  for (const s of mapped) {
    if (!isNavDivider(s) && isNavGroup(s)) {
      groupsByLabel.set(s.label, s);
    }
  }

  const out: NavSectionV2[] = [];
  if (home) out.push(home);

  for (const cat of SUPERCATEGORIES) {
    const present = cat.groups
      .map((label) => groupsByLabel.get(label))
      .filter((g): g is NavGroupItem => g !== undefined);
    if (present.length === 0) continue;
    out.push({ kind: "section-label", label: cat.label });
    out.push(...present);
  }

  return out;
}
