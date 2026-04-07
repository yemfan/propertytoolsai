import type { NavConfig } from "@repo/ui";
import { BarChart3, CreditCard, Headphones, LayoutDashboard, LayoutGrid } from "lucide-react";

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
 *
 * Restructured to use collapsible groups (matching PropertyTools pattern)
 * so users can see everything at a glance without being overwhelmed.
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
      label: "CRM",
      defaultOpen: true,
      icon: navEmoji("👥"),
      items: [
        {
          label: "Inbox",
          href: "/dashboard/inbox",
          match: ["/dashboard/inbox"],
          icon: navEmoji("📥"),
        },
        {
          label: "Lead Queue",
          href: "/dashboard/lead-queue",
          match: ["/dashboard/lead-queue"],
          icon: navEmoji("📋"),
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
      ],
    },
    {
      label: "Workspace",
      defaultOpen: true,
      icon: navEmoji("🧰"),
      items: [
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
        {
          label: "Portal",
          href: "/portal",
          match: ["/portal"],
          icon: <LayoutGrid size={16} strokeWidth={2} aria-hidden />,
        },
      ],
    },
    {
      label: "Account",
      icon: navEmoji("⚙️"),
      items: [
        {
          label: "Settings",
          href: "/dashboard/settings",
          match: ["/dashboard/settings", "/dashboard/notifications"],
          icon: navEmoji("⚙️"),
        },
        {
          label: "Billing",
          href: "/dashboard/billing",
          match: ["/dashboard/billing"],
          icon: navEmoji("💳"),
        },
        {
          label: "Profile",
          href: "/account/profile",
          match: ["/account/profile"],
          icon: navEmoji("👤"),
        },
        {
          label: "Support",
          href: "/support",
          match: ["/support"],
          icon: <Headphones size={16} strokeWidth={2} aria-hidden />,
        },
      ],
    },
    { kind: "divider" as const },
    {
      label: "Admin",
      icon: <LayoutDashboard size={18} strokeWidth={2} aria-hidden />,
      roles: ["admin"],
      items: [
        {
          label: "Platform Overview",
          href: "/admin/platform-overview",
          roles: ["admin"],
          match: ["/admin/platform-overview"],
          icon: <LayoutDashboard size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Founder analytics",
          href: "/admin/founder",
          roles: ["admin"],
          match: ["/admin/founder"],
          icon: <BarChart3 size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Billing",
          href: "/admin/billing",
          roles: ["admin"],
          match: ["/admin/billing"],
          icon: <CreditCard size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Support inbox",
          href: "/admin/support",
          roles: ["admin", "support"],
          match: ["/admin/support"],
          icon: <Headphones size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Lead Queue",
          href: "/admin/lead-queue",
          roles: ["admin", "support"],
          match: ["/admin/lead-queue"],
          icon: navEmoji("📋"),
        },
      ],
    },
  ],
} satisfies NavConfig;

export const leadSmartNav = navConfig.sections;

export { default as marketingNavConfig, leadSmartMarketingNav } from "./marketing.nav.config";

export default navConfig;
