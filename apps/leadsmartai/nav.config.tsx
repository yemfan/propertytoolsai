import type { NavConfig } from "@repo/ui";
import { BarChart3, CreditCard, Headphones, LayoutDashboard } from "lucide-react";

function navEmoji(emoji: string) {
  return (
    <span
      className="flex h-[1.125rem] w-[1.125rem] items-center justify-center text-base leading-none"
      aria-hidden
    >
      {emoji}
    </span>
  );
}

/**
 * LeadSmart AI — agent portal sidebar (desktop `lg+`) + mobile drawer.
 * Groups separated by dividers; admin routes are role-gated.
 */
const navConfig = {
  id: "leadsmart",
  sidebarTitle: "Agent portal",
  sections: [
    {
      label: "Home",
      href: "/dashboard/overview",
      match: ["/dashboard", "/dashboard/overview", "/dashboard/broker"],
      icon: navEmoji("🏠"),
    },
    {
      label: "Inbox",
      href: "/dashboard/inbox",
      match: ["/dashboard/inbox"],
      icon: navEmoji("📥"),
    },
    {
      label: "Leads",
      href: "/dashboard/leads",
      match: ["/dashboard/leads"],
      icon: navEmoji("👥"),
    },
    {
      label: "Tasks",
      href: "/dashboard/tasks",
      match: ["/dashboard/tasks"],
      icon: navEmoji("✅"),
    },
    {
      label: "Calendar",
      href: "/dashboard/calendar",
      match: ["/dashboard/calendar"],
      icon: navEmoji("📅"),
    },
    { kind: "divider" as const },
    {
      label: "Tools",
      href: "/dashboard/tools",
      match: ["/dashboard/tools"],
      icon: navEmoji("🧰"),
    },
    {
      label: "Templates",
      href: "/dashboard/templates",
      match: ["/dashboard/templates"],
      icon: navEmoji("✉️"),
    },
    { kind: "divider" as const },
    {
      label: "Settings",
      href: "/dashboard/settings",
      match: ["/dashboard/settings", "/dashboard/billing", "/dashboard/notifications"],
      icon: navEmoji("⚙️"),
    },
    {
      label: "Profile",
      href: "/account/profile",
      match: ["/account/profile"],
      icon: navEmoji("👤"),
    },
    { kind: "divider" as const },
    {
      label: "Platform Overview",
      href: "/admin/platform-overview",
      roles: ["admin"],
      match: ["/admin/platform-overview"],
      icon: <LayoutDashboard size={18} strokeWidth={2} aria-hidden />,
    },
    {
      label: "Founder analytics",
      href: "/admin/founder",
      roles: ["admin"],
      match: ["/admin/founder"],
      icon: <BarChart3 size={18} strokeWidth={2} aria-hidden />,
    },
    {
      label: "Billing",
      href: "/admin/billing",
      roles: ["admin"],
      match: ["/admin/billing"],
      icon: <CreditCard size={18} strokeWidth={2} aria-hidden />,
    },
    {
      label: "Support inbox",
      href: "/admin/support",
      roles: ["admin", "support"],
      match: ["/admin/support"],
      icon: <Headphones size={18} strokeWidth={2} aria-hidden />,
    },
  ],
} satisfies NavConfig;

export const leadSmartNav = navConfig.sections;

export { default as marketingNavConfig, leadSmartMarketingNav } from "./marketing.nav.config";

export default navConfig;
