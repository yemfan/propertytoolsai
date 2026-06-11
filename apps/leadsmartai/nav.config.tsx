import type { NavConfig } from "@repo/ui";
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
  Receipt,
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
 * Visual structure (consumed by `PremiumSidebarV2`):
 *   pinned Boss Assistant  →  AI TEAM band  →  WORK band  →  ENGAGE band  →  ANALYZE band  →  MANAGE band  →  Admin
 *
 * The supercategory bands ("section-label" sections) collapse the ten
 * collapsible groups into four scannable clusters; legacy `PremiumSidebar`
 * + `MobileSidebar` either skip the band rows or render them as small
 * labels (see `packages/ui/navigation`).
 *
 * Sections kept their original semantics:
 *   Boss Assistant — AI Chief of Staff command center (default home)
 *   Your AI Team — AI Receptionist / Sales Assistant / Transaction Assistant
 *   Leads        — prospecting + ops (contacts, queue, tasks, calendar)
 *   Buyers       — buyer-side activity (showings → offers)
 *   Sellers      — seller-side activity (presentations, listings)
 *   Transactions — operational layer (all deals + Coordinator kanban)
 *   Communicate  — inbox, drafts, templates, marketing plans
 *   Workflow     — sales model + playbooks
 *   Insights     — performance, growth, sphere monetization
 *   Property Tools — calculator suite + CMA library
 *   Account      — settings, billing, profile, support
 *   Admin        — role-gated platform management
 */
const navConfig = {
  id: "leadsmart",
  sidebarTitle: "RealtorBoss",
  sections: [
    /* ── Boss Assistant — the AI Chief of Staff command center ── */
    {
      label: "Boss Assistant",
      href: "/dashboard/boss",
      match: ["/dashboard", "/dashboard/boss", "/dashboard/broker"],
      icon: p(<LayoutDashboard size={17} strokeWidth={STROKE} aria-hidden />),
    },

    /* ── YOUR AI TEAM ── the three working assistants ── */
    { kind: "section-label" as const, label: "Your AI Team" },
    {
      label: "AI Receptionist",
      href: "/dashboard/ai-receptionist",
      match: ["/dashboard/ai-receptionist"],
      icon: p(<Headphones size={17} strokeWidth={STROKE} aria-hidden />),
    },
    {
      label: "AI Sales Assistant",
      href: "/dashboard/ai-sales-assistant",
      match: ["/dashboard/ai-sales-assistant"],
      icon: p(<Sparkles size={17} strokeWidth={STROKE} aria-hidden />),
    },
    {
      label: "AI Transaction Assistant",
      href: "/dashboard/ai-transaction-assistant",
      match: ["/dashboard/ai-transaction-assistant"],
      icon: p(<KeyRound size={17} strokeWidth={STROKE} aria-hidden />),
    },
    {
      label: "Manage AI Team",
      href: "/dashboard/ai-team",
      match: ["/dashboard/ai-team"],
      icon: p(<Settings size={17} strokeWidth={STROKE} aria-hidden />),
    },

    /* ── WORK ── side-of-deal activity + the bridge transactional layer ── */
    { kind: "section-label" as const, label: "Work" },

    /* ── Leads ── daily prospecting + ops + lead-gen events ── */
    {
      label: "Leads",
      defaultOpen: true,
      icon: p(<Users size={17} strokeWidth={STROKE} aria-hidden />),
      items: [
        {
          // Unified people hub — Smart Lists inside this page segment into
          // Leads, Sphere, All. Old /dashboard/leads and /dashboard/sphere
          // routes redirect here.
          label: "Contacts",
          href: "/dashboard/contacts",
          match: [
            "/dashboard/contacts",
            "/dashboard/leads",
            "/dashboard/sphere",
          ],
          icon: l(<Users size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Tasks",
          href: "/dashboard/tasks",
          match: ["/dashboard/tasks"],
          icon: l(<CheckCircle2 size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Calendar",
          href: "/dashboard/calendar",
          match: ["/dashboard/calendar"],
          icon: l(<Calendar size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          // Open houses are a lead-generation surface — buyer-side
          // agents host floor-time events for other agents' listings,
          // and listing agents host their own. Either way the
          // outcome is captured visitors, so it lives with Leads, not
          // strictly under Sellers.
          label: "Open Houses",
          href: "/dashboard/open-houses",
          match: ["/dashboard/open-houses", "/dashboard/open-house"],
          icon: l(<DoorOpen size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          // Triage queue lives at the bottom — agents land here only when
          // they're actively claiming new inbound, not for daily prospecting.
          label: "Lead Queue",
          href: "/dashboard/lead-queue",
          match: ["/dashboard/lead-queue"],
          icon: l(<ClipboardList size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          // Generate Leads — AI-drafted social posts (Phase 1A) + ad
          // campaigns on Meta/Google (Phase 2+). Sits next to Lead Queue
          // since both are about pulling NEW inbound into the CRM rather
          // than working existing contacts.
          label: "Generate Leads",
          href: "/dashboard/leads/generate",
          match: ["/dashboard/leads/generate"],
          icon: l(<Sparkles size={14} strokeWidth={STROKE} aria-hidden />),
        },
      ],
    },

    /* ── Buyers ── buyer-side activity ── */
    {
      label: "Buyers",
      defaultOpen: true,
      icon: p(<ShoppingBag size={17} strokeWidth={STROKE} aria-hidden />),
      items: [
        {
          // Buyer-side property-visit tracker: schedule + feedback capture.
          label: "Showings",
          href: "/dashboard/showings",
          match: ["/dashboard/showings"],
          icon: l(<Eye size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          // Buyer-side offer tracker: drafts, counters, acceptance → transaction.
          label: "Offers",
          href: "/dashboard/offers",
          match: ["/dashboard/offers"],
          icon: l(<FileSignature size={14} strokeWidth={STROKE} aria-hidden />),
        },
      ],
    },

    /* ── Sellers ── listing-side activity. Open Houses lives under
       Leads (lead-gen surface); CMAs live under Property Tools (used on
       both sides for pricing strategy AND offer sizing). ── */
    {
      label: "Sellers",
      icon: p(<Tag size={17} strokeWidth={STROKE} aria-hidden />),
      items: [
        {
          // Agent's active + closed listings, backed by /dashboard/properties
          // — kept that URL since the CommandPalette already links there.
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
      ],
    },

    /* ── Transactions ── operational layer that spans both sides.
       `match` is exact (see packages/ui/navigation/matchPath.ts), so
       /dashboard/transactions/coordinator highlights Coordinator
       without colliding with the All deals entry. ── */
    {
      label: "Transactions",
      defaultOpen: true,
      icon: p(<KeyRound size={17} strokeWidth={STROKE} aria-hidden />),
      items: [
        {
          label: "All deals",
          href: "/dashboard/transactions",
          match: ["/dashboard/transactions"],
          icon: l(<KeyRound size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Coordinator",
          href: "/dashboard/transactions/coordinator",
          match: ["/dashboard/transactions/coordinator"],
          icon: l(<LayoutGrid size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Books",
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

    /* ── ENGAGE ── outbound + workflow scaffolding ── */
    { kind: "section-label" as const, label: "Engage" },

    {
      label: "Communicate",
      icon: p(<MessageCircle size={17} strokeWidth={STROKE} aria-hidden />),
      items: [
        {
          label: "Conversations",
          href: "/dashboard/inbox",
          match: ["/dashboard/inbox", "/dashboard/calls"],
          icon: l(<MessageCircle size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          // The voice console — Inbound (incoming-call activity +
          // missed-call auto-text settings) and Outbound (place AI calls).
          // Renamed from "AI Assistant" so it doesn't collide with the
          // "Your AI Team" band; the AI Receptionist page links here.
          label: "Voice Console",
          href: "/dashboard/missed-call",
          match: ["/dashboard/missed-call"],
          icon: l(<PhoneMissed size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          label: "Drafts",
          href: "/dashboard/drafts",
          match: ["/dashboard/drafts"],
          icon: l(<PenLine size={14} strokeWidth={STROKE} aria-hidden />),
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
      ],
    },

    /* ── Workflow ── sales model + playbooks ── */
    {
      label: "Workflow",
      icon: p(<Wrench size={17} strokeWidth={STROKE} aria-hidden />),
      items: [
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
      ],
    },

    /* ── ANALYZE ── insight + calculator suites ── */
    { kind: "section-label" as const, label: "Analyze" },

    {
      label: "Insights",
      icon: p(<TrendingUp size={17} strokeWidth={STROKE} aria-hidden />),
      items: [
        {
          // The classic daily-overview dashboard — superseded as the
          // default home by the Boss Assistant but kept reachable.
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
          // Actionable nudges pulled live from CRM data: stale past
          // clients, unreplied hot leads, response-time benchmark, drip
          // health, past-due deals.
          label: "Coaching",
          href: "/dashboard/coaching",
          match: ["/dashboard/coaching"],
          icon: l(<Compass size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          // Combined sphere monetization view — seller + buyer scores
          // per past-client / sphere contact, side-by-side, sorted by
          // combined leverage. Pairs with the both_high drip cadence.
          label: "Sphere monetization",
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
      ],
    },

    /* ── Property Tools ── calculator suite + CMA library. CMAs live
       here (not under Sellers) because they're useful on both sides:
       sellers see them as pricing strategy, buyers use them to size
       offers. ── */
    {
      label: "Property Tools",
      icon: p(<Building2 size={17} strokeWidth={STROKE} aria-hidden />),
      items: [
        {
          label: "All tools",
          href: "/dashboard/tools",
          match: ["/dashboard/tools"],
          icon: l(<Wrench size={14} strokeWidth={STROKE} aria-hidden />),
        },
        {
          // Per-agent CMA library — saved snapshots with PDF + email-
          // to-contact flow. The Smart CMA Builder tile on the tools
          // page is what creates new CMAs; this is where they live.
          label: "CMAs",
          href: "/dashboard/cma",
          match: ["/dashboard/cma"],
          icon: l(<Ruler size={14} strokeWidth={STROKE} aria-hidden />),
        },
      ],
    },

    /* ── MANAGE ── settings + role-gated platform admin ── */
    { kind: "section-label" as const, label: "Manage" },

    {
      label: "Account",
      icon: p(<Settings size={17} strokeWidth={STROKE} aria-hidden />),
      items: [
        {
          label: "Settings",
          href: "/dashboard/settings",
          match: ["/dashboard/settings", "/dashboard/notifications"],
          icon: l(<Settings size={14} strokeWidth={STROKE} aria-hidden />),
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
          // Support staff inbox — hidden for non-staff so agents
          // don't click through and bounce off /unauthorized. The
          // public customer-support chat lives at /contact and the
          // Help center; this sidebar entry is only useful to
          // admin / support roles.
          label: "Support",
          href: "/support",
          match: ["/support"],
          roles: ["admin", "support"],
          icon: l(<Headphones size={14} strokeWidth={STROKE} aria-hidden />),
        },
      ],
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
          // Read-only roster of every agent in the IDX routing pool
          // (DB rules + env allowlist), with last-assignment + 30d
          // activity. Companion to PR #165's per-agent settings.
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
