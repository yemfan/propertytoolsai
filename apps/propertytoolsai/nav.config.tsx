import type { NavConfig } from "@repo/ui";
import {
  Banknote,
  BriefcaseBusiness,
  Calculator,
  DollarSign,
  FileBarChart,
  GitCompare,
  Home,
  LayoutDashboard,
  LifeBuoy,
  Lightbulb,
  PiggyBank,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  TrendingUp,
  User,
  UserCircle2,
  Wallet,
  Wand2,
} from "lucide-react";

/**
 * PropertyToolsAI sidebar + mobile drawer nav.
 * Repo folder: `apps/propertytoolsai` (product: PropertyToolsAI).
 *
 * Types: import `NavConfig` / `NavSection` from `@repo/ui` (not `@/packages/ui/...`).
 *
 * Pretty paths like `/cma-report` are redirected in `next.config.js` to existing tools.
 *
 * ── Icon guidelines ────────────────────────────────────────────────
 * Every item should have a DISTINCT icon. Earlier versions had three
 * calculators all using `<Calculator>`, three investing items all
 * using `<BarChart3>`, and three AI items all using `<Sparkles>`,
 * which made the sidebar feel repetitive. Current mapping tries to
 * give each item a unique visual anchor while keeping the parent-
 * group icons recognizable as category headers.
 */
const navConfig = {
  id: "property-tools",
  sidebarTitle: "Tools",
  sections: [
    {
      label: "Home",
      href: "/",
      match: ["/"],
      icon: <LayoutDashboard size={18} strokeWidth={2} aria-hidden />,
    },
    {
      label: "Home Value",
      defaultOpen: true,
      icon: <Home size={18} strokeWidth={2} aria-hidden />,
      items: [
        {
          label: "Estimate",
          href: "/home-value",
          icon: <Target size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "CMA Report",
          href: "/cma-report",
          icon: <FileBarChart size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Market Value Trends",
          href: "/market-value-trends",
          icon: <TrendingUp size={16} strokeWidth={2} aria-hidden />,
        },
      ],
    },
    {
      label: "Financing",
      defaultOpen: true,
      icon: <DollarSign size={18} strokeWidth={2} aria-hidden />,
      items: [
        {
          label: "Mortgage Calculator",
          href: "/mortgage-calculator",
          icon: <Calculator size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Affordability Calculator",
          href: "/affordability-calculator",
          icon: <Wallet size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Refinance Calculator",
          href: "/refinance-calculator",
          icon: <RefreshCw size={16} strokeWidth={2} aria-hidden />,
        },
      ],
    },
    {
      label: "Investing",
      icon: <BriefcaseBusiness size={18} strokeWidth={2} aria-hidden />,
      items: [
        {
          label: "Rent Estimator",
          href: "/rent-estimator",
          icon: <Banknote size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "ROI / Cash Flow",
          href: "/roi-cash-flow",
          icon: <PiggyBank size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Rent vs Buy",
          href: "/rent-vs-buy",
          icon: <Scale size={16} strokeWidth={2} aria-hidden />,
        },
      ],
    },
    {
      label: "AI Tools",
      defaultOpen: true,
      icon: <Sparkles size={18} strokeWidth={2} aria-hidden />,
      items: [
        {
          label: "AI Property Comparison",
          href: "/ai-property-comparison",
          badge: "Pro",
          icon: <GitCompare size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "AI Recommended Properties",
          href: "/ai-recommended-properties",
          icon: <Wand2 size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Smart Next Steps",
          href: "/smart-next-steps",
          icon: <Lightbulb size={16} strokeWidth={2} aria-hidden />,
        },
      ],
    },
    {
      label: "Account",
      icon: <UserCircle2 size={18} strokeWidth={2} aria-hidden />,
      items: [
        {
          label: "Profile",
          href: "/account/profile",
          icon: <User size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Support",
          href: "/support",
          icon: <LifeBuoy size={16} strokeWidth={2} aria-hidden />,
        },
      ],
    },
  ],
} satisfies NavConfig;

/** Sidebar / topbar sections — same as `navConfig.sections`. */
export const propertyToolsNav = navConfig.sections;

export default navConfig;
