import type { NavConfig } from "@repo/ui";
import {
  BarChart3,
  BriefcaseBusiness,
  Calculator,
  DollarSign,
  Home,
  House,
  Landmark,
  Sparkles,
  Star,
} from "lucide-react";

/**
 * PropertyToolsAI sidebar + mobile drawer nav.
 * Repo folder: `apps/property-tools` (product: PropertyToolsAI).
 *
 * Types: import `NavConfig` / `NavSection` from `@repo/ui` (not `@/packages/ui/...`).
 *
 * Pretty paths like `/cma-report` are redirected in `next.config.js` to existing tools.
 */
const navConfig = {
  id: "property-tools",
  sidebarTitle: "Tools",
  sections: [
    {
      label: "Home",
      href: "/",
      match: ["/"],
      icon: <House size={18} strokeWidth={2} aria-hidden />,
    },
    {
      label: "Home Value",
      icon: <Home size={18} strokeWidth={2} aria-hidden />,
      items: [
        {
          label: "Estimate",
          href: "/home-value",
          icon: <Home size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "CMA Report",
          href: "/cma-report",
          icon: <BarChart3 size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Market Value Trends",
          href: "/market-value-trends",
          icon: <Landmark size={16} strokeWidth={2} aria-hidden />,
        },
      ],
    },
    {
      label: "Financing",
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
          icon: <Calculator size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Refinance Calculator",
          href: "/refinance-calculator",
          icon: <Calculator size={16} strokeWidth={2} aria-hidden />,
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
          icon: <BarChart3 size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "ROI / Cash Flow",
          href: "/roi-cash-flow",
          icon: <BarChart3 size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Rent vs Buy",
          href: "/rent-vs-buy",
          icon: <BarChart3 size={16} strokeWidth={2} aria-hidden />,
        },
      ],
    },
    {
      label: "AI Tools",
      icon: <Sparkles size={18} strokeWidth={2} aria-hidden />,
      items: [
        {
          label: "AI Property Comparison",
          href: "/ai-property-comparison",
          badge: "Pro",
          icon: <Sparkles size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "AI Recommended Properties",
          href: "/ai-recommended-properties",
          icon: <Sparkles size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Smart Next Steps",
          href: "/smart-next-steps",
          icon: <Sparkles size={16} strokeWidth={2} aria-hidden />,
        },
      ],
    },
    {
      label: "Recommended",
      icon: <Star size={18} strokeWidth={2} aria-hidden />,
      items: [
        {
          label: "Compare Properties",
          href: "/ai-property-comparison",
          icon: <Sparkles size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Check Mortgage",
          href: "/mortgage-calculator",
          icon: <Calculator size={16} strokeWidth={2} aria-hidden />,
        },
        {
          label: "Unlock Premium",
          href: "/pricing",
          badge: "Upgrade",
          icon: <Star size={16} strokeWidth={2} aria-hidden />,
        },
      ],
    },
  ],
} satisfies NavConfig;

/** Sidebar / topbar sections — same as `navConfig.sections`. */
export const propertyToolsNav = navConfig.sections;

export default navConfig;
