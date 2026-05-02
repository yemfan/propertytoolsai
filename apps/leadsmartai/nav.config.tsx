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
 * Organized around which side of the deal the agent is working
 * ("am I doing buyer work or seller work right now?") rather than the
 * older Deals/Listings split, which was asymmetric — Deals owned
 * Transactions even though listing-rep deals also become transactions.
 *
 * Sections:
 *   Home         — daily overview
 *   Leads        — prospecting + ops (contacts, queue, tasks, calendar)
 *   Buyers       — buyer-side activity (showings → offers)
 *   Sellers      — seller-side activity (presentations, CMAs, open
 *                  houses, reports)
 *   Transactions — operational layer that bridges both sides:
 *                  the list of deals + the stage-grouped kanban
 *                  (Coordinator). One transaction can be buyer-rep,
 *                  listing-rep, or dual.
 *   Communicate  — inbox, drafts, templates, marketing plans
 *   Workflow     — property tools + playbooks
 *   Insights     — performance, growth
 *   Account      — settings, billing, profile, support
 *   Admin        — role-gated platform management
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

    /* ── Leads ── daily prospecting + ops ── */
    {
      label: "Leads",
      defaultOpen: true,
      icon: navEmoji("👥"),
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
        {
          // Triage queue lives at the bottom — agents land here only when
          // they're actively claiming new inbound, not for daily prospecting.
          label: "Lead Queue",
          href: "/dashboard/lead-queue",
          match: ["/dashboard/lead-queue"],
          icon: navEmoji("📋"),
        },
      ],
    },

    /* ── Buyers ── buyer-side activity ── */
    {
      label: "Buyers",
      defaultOpen: true,
      icon: navEmoji("🛒"),
      items: [
        {
          // Buyer-side property-visit tracker: schedule + feedback capture.
          // See apps/leadsmartai/lib/showings.
          label: "Showings",
          href: "/dashboard/showings",
          match: ["/dashboard/showings"],
          icon: navEmoji("🏠"),
        },
        {
          // Buyer-side offer tracker: drafts, counters, acceptance → transaction.
          // See apps/leadsmartai/lib/offers.
          label: "Offers",
          href: "/dashboard/offers",
          match: ["/dashboard/offers"],
          icon: navEmoji("📝"),
        },
      ],
    },

    /* ── Sellers ── listing-side activity ── */
    {
      label: "Sellers",
      icon: navEmoji("🏷️"),
      items: [
        {
          label: "Presentations",
          href: "/dashboard/seller-presentation",
          match: ["/dashboard/seller-presentation", "/dashboard/presentations"],
          icon: navEmoji("📊"),
        },
        {
          // Per-agent CMA library — pulls comps + valuation from the
          // upstream propertytoolsai engine and stores snapshots here.
          // Each saved CMA has a PDF + email-to-seller flow.
          label: "CMAs",
          href: "/dashboard/cma",
          match: ["/dashboard/cma"],
          icon: navEmoji("📐"),
        },
        {
          label: "Open Houses",
          href: "/dashboard/open-houses",
          match: ["/dashboard/open-houses", "/dashboard/open-house"],
          icon: navEmoji("🏠"),
        },
        {
          label: "Reports",
          href: "/dashboard/reports",
          match: ["/dashboard/reports", "/dashboard/comparison-report"],
          icon: navEmoji("📄"),
        },
      ],
    },

    /* ── Transactions ── operational layer that spans both sides ──
       Pulled out of Deals so listing-rep closings live in the same
       place as buyer-rep ones. Two views of the same data:
         All deals  → flat list (every status; click into a row for the
                      per-deal timeline + tasks + counterparties)
         Coordinator → stage-grouped kanban over in-flight deals
       `match` is exact (see packages/ui/navigation/matchPath.ts), so
       /dashboard/transactions/coordinator highlights Coordinator
       without colliding with the All deals entry. */
    {
      label: "Transactions",
      defaultOpen: true,
      icon: navEmoji("🔑"),
      items: [
        {
          label: "All deals",
          href: "/dashboard/transactions",
          match: ["/dashboard/transactions"],
          icon: navEmoji("🔑"),
        },
        {
          label: "Coordinator",
          href: "/dashboard/transactions/coordinator",
          match: ["/dashboard/transactions/coordinator"],
          icon: navEmoji("🗂️"),
        },
      ],
    },

    /* ── Communicate ── */
    {
      label: "Communicate",
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

    /* ── Workflow ── sales model + playbooks ── */
    {
      label: "Workflow",
      icon: navEmoji("🧰"),
      items: [
        {
          label: "Sales Model",
          href: "/dashboard/sales-model",
          match: ["/dashboard/sales-model"],
          icon: navEmoji("🎯"),
        },
        {
          label: "Playbooks",
          href: "/dashboard/playbooks",
          match: ["/dashboard/playbooks"],
          icon: navEmoji("📋"),
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
          // Actionable nudges pulled live from CRM data: stale past
          // clients, unreplied hot leads, response-time benchmark, drip
          // health, past-due deals.
          label: "Coaching",
          href: "/dashboard/coaching",
          match: ["/dashboard/coaching"],
          icon: navEmoji("🧭"),
        },
        {
          // Combined sphere monetization view — seller + buyer scores
          // per past-client / sphere contact, side-by-side, sorted by
          // combined leverage. Pairs with the both_high drip cadence.
          label: "Sphere monetization",
          href: "/dashboard/sphere/monetization",
          match: ["/dashboard/sphere/monetization"],
          icon: navEmoji("💎"),
        },
        {
          label: "Growth & Opportunities",
          href: "/dashboard/growth",
          match: ["/dashboard/growth"],
          icon: navEmoji("🚀"),
        },
      ],
    },

    /* ── Property Tools ── top-level shortcut to the calculator
       suite, pulled out of Workflow so agents can find it without
       expanding a group. ── */
    {
      label: "Property Tools",
      href: "/dashboard/tools",
      match: ["/dashboard/tools"],
      icon: navEmoji("🏡"),
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
          // Support staff inbox — hidden for non-staff so agents
          // don't click through and bounce off /unauthorized. The
          // public customer-support chat lives at /contact and the
          // Help center; this sidebar entry is only useful to
          // admin / support roles.
          label: "Support",
          href: "/support",
          match: ["/support"],
          roles: ["admin", "support"],
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
        {
          // Read-only roster of every agent in the IDX routing pool
          // (DB rules + env allowlist), with last-assignment + 30d
          // activity. Companion to PR #165's per-agent settings.
          label: "Lead Routing",
          href: "/dashboard/admin/lead-routing",
          roles: ["admin"],
          match: ["/dashboard/admin/lead-routing"],
          icon: navEmoji("🛣️"),
        },
      ],
    },
  ],
} satisfies NavConfig;

export const leadSmartNav = navConfig.sections;

export { default as marketingNavConfig, leadSmartMarketingNav } from "./marketing.nav.config";

export default navConfig;
