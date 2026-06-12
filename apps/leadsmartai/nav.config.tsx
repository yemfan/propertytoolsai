import type { NavConfig } from "@repo/ui";
import {
  BarChart3,
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
  Receipt,
  Rocket,
  Route,
  Ruler,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  User,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";

const STROKE = 1.75;

/** Group-row icon (17px). */
function p(icon: ReactNode): ReactNode {
  return icon;
}
/** Leaf-row icon (14px). */
function l(icon: ReactNode): ReactNode {
  return icon;
}

/**
 * RealtorBoss — agent portal sidebar.
 *
 * Structure per the theme constitution's preferred navigation (and the
 * user's spec):
 *
 *   Boss Assistant · Calendar · Tasks · Leads · Transactions
 *   ──────
 *   Receptionist · Sales Assistant · Transaction Assistant · Accountant
 *   ──────
 *   More (collapsed — everything else stays reachable) · Settings
 *
 * Every feature that used to live in the Work/Engage/Analyze/Manage
 * bands kept its route; the long tail now lives in the collapsed
 * "More" group so the daily surface stays calm (constitution: the
 * software should not feel busy).
 */
const navConfig = {
  id: "leadsmart",
  sidebarTitle: "RealtorBoss",
  sections: [
    /* ── The Boss's day ── */
    {
      label: "Boss Assistant",
      href: "/dashboard/boss",
      match: ["/dashboard", "/dashboard/boss", "/dashboard/broker"],
      icon: p(<House size={17} strokeWidth={STROKE} aria-hidden />),
    },
    {
      label: "Calendar",
      href: "/dashboard/calendar",
      match: ["/dashboard/calendar"],
      icon: p(<Calendar size={17} strokeWidth={STROKE} aria-hidden />),
    },
    {
      label: "Tasks",
      href: "/dashboard/tasks",
      match: ["/dashboard/tasks"],
      icon: p(<CheckCircle2 size={17} strokeWidth={STROKE} aria-hidden />),
    },
    {
      // Unified people hub — Smart Lists inside segment into Leads,
      // Sphere, All. Old /dashboard/leads + /dashboard/sphere redirect here.
      label: "Leads",
      href: "/dashboard/contacts",
      match: ["/dashboard/contacts", "/dashboard/leads", "/dashboard/sphere"],
      icon: p(<Users size={17} strokeWidth={STROKE} aria-hidden />),
    },
    {
      label: "Transactions",
      href: "/dashboard/transactions",
      match: ["/dashboard/transactions"],
      icon: p(<KeyRound size={17} strokeWidth={STROKE} aria-hidden />),
    },
    {
      // Shared by most of the team (Receptionist answers, Sales
      // Assistant follows up) — so it stays a common work row rather
      // than living under any single assistant.
      label: "Conversations",
      href: "/dashboard/inbox",
      match: ["/dashboard/inbox", "/dashboard/calls"],
      icon: p(<MessageCircle size={17} strokeWidth={STROKE} aria-hidden />),
    },

    /* ── Your AI Team — each agent groups the work IT does.
       Surfaces shared by most agents (Conversations) stay above. ── */
    { kind: "divider" as const },
    {
      label: "Receptionist",
      icon: p(<Headphones size={17} strokeWidth={STROKE} aria-hidden />),
      items: [
        {
          label: "Overview",
          href: "/dashboard/ai-receptionist",
          match: ["/dashboard/ai-receptionist"],
          icon: l(<Headphones size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          // All calls live here — inbound answering, text-backs, and
          // outbound AI calls. The phone is the Receptionist's
          // instrument in both directions.
          label: "Voice Console",
          href: "/dashboard/missed-call",
          match: ["/dashboard/missed-call"],
          icon: l(<PhoneMissed size={14} strokeWidth={STROKE} aria-hidden />),
        },
      ],
    },
    {
      label: "Sales Assistant",
      icon: p(<TrendingUp size={17} strokeWidth={STROKE} aria-hidden />),
      items: [
        {
          label: "Overview",
          href: "/dashboard/ai-sales-assistant",
          match: ["/dashboard/ai-sales-assistant"],
          icon: l(<TrendingUp size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          // Its approval queue — messages drafted by the assistant,
          // waiting for the Boss to approve before they send.
          label: "Drafts",
          href: "/dashboard/drafts",
          match: ["/dashboard/drafts"],
          icon: l(<PenLine size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Lead Queue",
          href: "/dashboard/lead-queue",
          match: ["/dashboard/lead-queue"],
          icon: l(<ClipboardList size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Templates",
          href: "/dashboard/templates",
          match: ["/dashboard/templates"],
          icon: l(<ClipboardList size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Marketing Plans",
          href: "/dashboard/marketing/plans",
          match: ["/dashboard/marketing"],
          icon: l(<Megaphone size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Generate Leads",
          href: "/dashboard/leads/generate",
          match: ["/dashboard/leads/generate"],
          icon: l(<Sparkles size={14} strokeWidth={STROKE} aria-hidden />),
        },
      ],
    },
    {
      label: "Transaction Assistant",
      icon: p(<ClipboardList size={17} strokeWidth={STROKE} aria-hidden />),
      items: [
        {
          label: "Overview",
          href: "/dashboard/ai-transaction-assistant",
          match: ["/dashboard/ai-transaction-assistant"],
          icon: l(<ClipboardList size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Coordinator Board",
          href: "/dashboard/transactions/coordinator",
          match: ["/dashboard/transactions/coordinator"],
          icon: l(<LayoutGrid size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Offers",
          href: "/dashboard/offers",
          match: ["/dashboard/offers"],
          icon: l(<FileSignature size={14} strokeWidth={STROKE} aria-hidden />),
        },
      ],
    },
    {
      label: "Accountant",
      icon: p(<Receipt size={17} strokeWidth={STROKE} aria-hidden />),
      items: [
        {
          label: "Overview",
          href: "/dashboard/ai-accountant",
          match: ["/dashboard/ai-accountant"],
          icon: l(<Receipt size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Invoices",
          href: "/dashboard/books",
          match: ["/dashboard/books"],
          icon: l(<Receipt size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Expenses",
          href: "/dashboard/expenses",
          match: ["/dashboard/expenses"],
          icon: l(<Wallet size={14} strokeWidth={STROKE} aria-hidden />),
        },
      ],
    },
    {
      label: "Manage AI Team",
      href: "/dashboard/ai-team",
      match: ["/dashboard/ai-team"],
      icon: p(<Settings size={17} strokeWidth={STROKE} aria-hidden />),
    },

    /* ── Everything else, collapsed ── */
    { kind: "divider" as const },
    {
      // The Realtor's own tools — things the human does, not the AI
      // team. Anything an agent does for you lives under that agent.
      label: "More",
      icon: p(<Wrench size={17} strokeWidth={STROKE} aria-hidden />),
      items: [
        {
          label: "Open Houses",
          href: "/dashboard/open-houses",
          match: ["/dashboard/open-houses", "/dashboard/open-house"],
          icon: l(<DoorOpen size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Showings",
          href: "/dashboard/showings",
          match: ["/dashboard/showings"],
          icon: l(<Eye size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Listings",
          href: "/dashboard/properties",
          match: ["/dashboard/properties"],
          icon: l(<House size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Presentations",
          href: "/dashboard/seller-presentation",
          match: ["/dashboard/seller-presentation", "/dashboard/presentations"],
          icon: l(<Presentation size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Sales Model",
          href: "/dashboard/sales-model",
          match: ["/dashboard/sales-model"],
          icon: l(<Target size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Playbooks",
          href: "/dashboard/playbooks",
          match: ["/dashboard/playbooks"],
          icon: l(<ClipboardList size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Daily Overview",
          href: "/dashboard/overview",
          match: ["/dashboard/overview"],
          icon: l(<LayoutDashboard size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Performance",
          href: "/dashboard/performance",
          match: ["/dashboard/performance"],
          icon: l(<BarChart3 size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Coaching",
          href: "/dashboard/coaching",
          match: ["/dashboard/coaching"],
          icon: l(<Compass size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Sphere Monetization",
          href: "/dashboard/sphere/monetization",
          match: ["/dashboard/sphere/monetization"],
          icon: l(<Gem size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Growth & Opportunities",
          href: "/dashboard/growth",
          match: ["/dashboard/growth"],
          icon: l(<Rocket size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Property Tools",
          href: "/dashboard/tools",
          match: ["/dashboard/tools"],
          icon: l(<Wrench size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "CMAs",
          href: "/dashboard/cma",
          match: ["/dashboard/cma"],
          icon: l(<Ruler size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Billing",
          href: "/dashboard/billing",
          match: ["/dashboard/billing"],
          icon: l(<CreditCard size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Profile",
          href: "/account/profile",
          match: ["/account/profile"],
          icon: l(<User size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          // Support staff inbox — hidden for non-staff roles.
          label: "Support",
          href: "/support",
          match: ["/support"],
          roles: ["admin", "support"],
          icon: l(<Headphones size={14} strokeWidth={STROKE} aria-hidden />),
        },
      ],
    },

    /* ── Settings ── */
    {
      label: "Settings",
      href: "/dashboard/settings",
      match: ["/dashboard/settings", "/dashboard/notifications"],
      icon: p(<Settings size={17} strokeWidth={STROKE} aria-hidden />),
    },

    /* ── Admin (role-gated) ── */
    { kind: "divider" as const },
    {
      label: "Admin",
      icon: p(<LayoutDashboard size={17} strokeWidth={STROKE} aria-hidden />),
      roles: ["admin"],
      items: [
        {
          label: "Platform Overview",
          href: "/admin/platform-overview",
          roles: ["admin"],
          match: ["/admin/platform-overview"],
          icon: l(<LayoutDashboard size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Analytics",
          href: "/admin/founder",
          roles: ["admin"],
          match: ["/admin/founder"],
          icon: l(<BarChart3 size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Billing",
          href: "/admin/billing",
          roles: ["admin"],
          match: ["/admin/billing"],
          icon: l(<CreditCard size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Support Inbox",
          href: "/admin/support",
          roles: ["admin", "support"],
          match: ["/admin/support"],
          icon: l(<Headphones size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Lead Queue",
          href: "/admin/lead-queue",
          roles: ["admin", "support"],
          match: ["/admin/lead-queue"],
          icon: l(<ClipboardList size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Lead Routing",
          href: "/dashboard/admin/lead-routing",
          roles: ["admin"],
          match: ["/dashboard/admin/lead-routing"],
          icon: l(<Route size={14} strokeWidth={STROKE} aria-hidden />),
        },
      ],
    },
  ],
} satisfies NavConfig;

export const leadSmartNav = navConfig.sections;

export { default as marketingNavConfig, leadSmartMarketingNav } from "./marketing.nav.config";

export default navConfig;
