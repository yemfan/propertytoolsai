import type { NavConfig } from "@repo/ui";
import {
  BarChart3,
  Bell,
  Calendar,
  CreditCard,
  FileText,
  GitBranch,
  Headphones,
  House,
  LayoutDashboard,
  MessageSquare,
  Phone,
  Settings,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

/**
 * LeadSmart AI — authenticated dashboard sidebar / mobile drawer.
 * Repo folder: `apps/leadsmartai`.
 *
 * Hrefs use real `/dashboard/*` routes (and `/deal-assistant`, `/agent/pricing`) so active states match.
 * Short paths like `/leads` still redirect via `next.config.js` for bookmarks.
 * Badge strings are placeholders until wired to live counts.
 */
const navConfig = {
  id: "leadsmart",
  sidebarTitle: "Workspace",
  sections: [
    {
      label: "Home",
      href: "/dashboard",
      match: ["/dashboard", "/dashboard/overview", "/dashboard/broker"],
      icon: <House size={18} strokeWidth={2} aria-hidden />,
    },
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
      label: "Leads",
      icon: <Users size={18} strokeWidth={2} aria-hidden />,
      items: [
        {
          label: "New Leads",
          href: "/dashboard/leads",
          badge: "12",
          icon: <Bell size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "All Leads",
          href: "/dashboard/leads",
          icon: <Users size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Calendar",
          href: "/dashboard/calendar",
          icon: <Calendar size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Assigned Leads",
          href: "/dashboard/contacts",
          icon: <Users size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Voice calls",
          href: "/dashboard/calls",
          icon: <Phone size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Lead Activity",
          href: "/dashboard/automation",
          icon: <MessageSquare size={16} strokeWidth={2} aria-hidden />,
        },
      ],
    },
    {
      label: "Opportunities",
      icon: <Target size={18} strokeWidth={2} aria-hidden />,
      items: [
        {
          label: "Lead Marketplace",
          href: "/dashboard/opportunities",
          icon: <Target size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Purchased Leads",
          href: "/dashboard/opportunities",
          icon: <FileText size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "New Alerts",
          href: "/dashboard/notifications",
          badge: "3",
          icon: <Bell size={16} strokeWidth={2} aria-hidden />,
        },
      ],
    },
    {
      label: "Pipeline",
      icon: <GitBranch size={18} strokeWidth={2} aria-hidden />,
      items: [
        {
          label: "Contacted",
          href: "/dashboard/contacts",
          icon: <GitBranch size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Qualified",
          href: "/dashboard/contacts",
          icon: <GitBranch size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Active Deal",
          href: "/dashboard/contacts",
          icon: <GitBranch size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Closed / Lost",
          href: "/dashboard/contacts",
          icon: <GitBranch size={16} strokeWidth={2} aria-hidden />,
        },
      ],
    },
    {
      label: "AI Tools",
      icon: <Sparkles size={18} strokeWidth={2} aria-hidden />,
      items: [
        {
          label: "AI Follow-Up",
          href: "/dashboard/automation",
          icon: <Sparkles size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "AI Property Comparison",
          href: "/dashboard/comparison-report",
          icon: <Sparkles size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Offer Assistant",
          href: "/deal-assistant",
          icon: <Sparkles size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Deal Closer",
          href: "/dashboard/tools",
          icon: <Sparkles size={16} strokeWidth={2} aria-hidden />,
        },
      ],
    },
    {
      label: "Reports",
      icon: <BarChart3 size={18} strokeWidth={2} aria-hidden />,
      items: [
        {
          label: "Performance",
          href: "/dashboard/performance",
          icon: <BarChart3 size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Lead Source Report",
          href: "/dashboard/reports",
          icon: <BarChart3 size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Conversion Report",
          href: "/dashboard/growth",
          icon: <BarChart3 size={16} strokeWidth={2} aria-hidden />,
        },
      ],
    },
    {
      label: "Settings",
      icon: <Settings size={18} strokeWidth={2} aria-hidden />,
      items: [
        {
          label: "Profile",
          href: "/dashboard/settings",
          icon: <Settings size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Team",
          href: "/dashboard/settings",
          icon: <Settings size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Billing",
          href: "/dashboard/billing",
          match: ["/dashboard/billing"],
          icon: <Settings size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Notifications",
          href: "/dashboard/notifications",
          icon: <Bell size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Support inbox",
          href: "/dashboard/support",
          icon: <Headphones size={16} strokeWidth={2} aria-hidden />,
        },
      ],
    },
  ],
} satisfies NavConfig;

/** Sidebar / topbar sections — same as `navConfig.sections`. */
export const leadSmartNav = navConfig.sections;

export { default as marketingNavConfig, leadSmartMarketingNav } from "./marketing.nav.config";

export default navConfig;
