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
 * LeadSmart AI — agent portal sidebar.
 *
 * Groups:
 *   Home        — daily overview
 *   CRM         — leads, tasks, calendar, contacts
 *   Communicate — inbox, calls, marketing plans
 *   Tools       — property analysis, presentations, reports, open houses
 *   Insights    — performance, growth
 *   Account     — settings, billing, profile, support
 *   Admin       — role-gated platform management
 */
const navConfig = {
  id: "leadsmart",
  sidebarTitle: "Agent portal",
  sections: [
    /* ── Home ── */
    {
      label: "Home",
      href: "/dashboard/overview",
      match: ["/dashboard", "/dashboard/overview", "/dashboard/broker"],
      icon: navEmoji("🏠"),
    },

    /* ── CRM ── */
    {
      label: "CRM",
      defaultOpen: true,
      icon: navEmoji("👥"),
      items: [
        {
          label: "Leads",
          href: "/dashboard/leads",
          match: ["/dashboard/leads"],
          icon: navEmoji("👥"),
        },
        {
          label: "Lead Queue",
          href: "/dashboard/lead-queue",
          match: ["/dashboard/lead-queue"],
          icon: navEmoji("📋"),
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
        {
          label: "Contacts",
          href: "/dashboard/contacts",
          match: ["/dashboard/contacts"],
          icon: navEmoji("📇"),
        },
      ],
    },

    /* ── Communicate ── */
    {
      label: "Communicate",
      defaultOpen: true,
      icon: navEmoji("💬"),
      items: [
        {
          label: "Messages",
          href: "/dashboard/inbox",
          match: ["/dashboard/inbox", "/dashboard/calls"],
          icon: navEmoji("💬"),
        },
        {
          label: "Drafts",
          href: "/dashboard/drafts",
          match: ["/dashboard/drafts"],
          icon: navEmoji("📝"),
        },
        {
          label: "Sphere",
          href: "/dashboard/sphere",
          match: ["/dashboard/sphere"],
          icon: navEmoji("🤝"),
        },
        {
          label: "Templates",
          href: "/dashboard/templates",
          match: ["/dashboard/templates"],
          icon: navEmoji("📋"),
        },
        {
          label: "Marketing Plans",
          href: "/dashboard/marketing/plans",
          match: ["/dashboard/marketing"],
          icon: navEmoji("📣"),
        },
      ],
    },

    /* ── Tools ── */
    {
      label: "Tools",
      icon: navEmoji("🧰"),
      items: [
        {
          label: "Property Tools",
          href: "/dashboard/tools",
          match: ["/dashboard/tools"],
          icon: navEmoji("🏡"),
        },
        {
          label: "Presentations",
          href: "/dashboard/seller-presentation",
          match: ["/dashboard/seller-presentation", "/dashboard/presentations"],
          icon: navEmoji("📊"),
        },
        {
          label: "Reports",
          href: "/dashboard/reports",
          match: ["/dashboard/reports", "/dashboard/comparison-report"],
          icon: navEmoji("📄"),
        },
        {
          label: "Open Houses",
          href: "/dashboard/open-houses",
          match: ["/dashboard/open-houses", "/dashboard/open-house"],
          icon: navEmoji("🏠"),
        },
      ],
    },

    /* ── Insights ── */
    {
      label: "Insights",
      icon: navEmoji("📈"),
      items: [
        {
          label: "Performance",
          href: "/dashboard/performance",
          match: ["/dashboard/performance"],
          icon: navEmoji("📈"),
        },
        {
          label: "Growth",
          href: "/dashboard/growth",
          match: ["/dashboard/growth"],
          icon: navEmoji("🚀"),
        },
      ],
    },

    /* ── Account ── */
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

    /* ── Admin (role-gated) ── */
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
          label: "Analytics",
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
          label: "Support Inbox",
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
