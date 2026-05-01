import { createElement } from "react";
import type { NavConfig } from "@repo/ui";
import { Calculator, FileText, Home, LayoutDashboard, Mail, MessageCircle, Phone, Search, Sparkles, Users } from "lucide-react";

// Lucide ships React-19-typed components; this project uses @types/react@18.
// Using createElement with a cast avoids the JSX return-type incompatibility.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function icon(C: unknown, size = 18) {
  return createElement(C as any, { size, strokeWidth: 2, "aria-hidden": true });
}

/**
 * Public marketing + free tools shell (non-dashboard routes).
 * Keeps dashboard links from eager prefetch where that caused auth/agent-row churn.
 */
const marketingNavConfig = {
  id: "leadsmart-marketing",
  sidebarTitle: "Tools",
  sections: [
    {
      label: "Home",
      href: "/",
      match: ["/"],
      icon: icon(Home),
    },
    {
      label: "Homes for sale",
      href: "/homes",
      match: ["/homes", "/homes/search", "/homes/[id]"],
      icon: icon(Search),
    },
    {
      label: "Test-drive our voice AI",
      href: "/voice-ai-test-drive",
      match: ["/voice-ai-test-drive"],
      icon: icon(Phone),
    },
    {
      label: "Site",
      icon: icon(LayoutDashboard),
      items: [
        { label: "About", href: "/about", icon: icon(FileText, 16) },
        { label: "Contact", href: "/contact", icon: icon(Mail, 16) },
        { label: "Support chat", href: "/support", icon: icon(MessageCircle, 16) },
      ],
    },
    {
      label: "Calculators & estimators",
      icon: icon(Calculator),
      items: [
        { label: "Mortgage Calculator", href: "/mortgage-calculator", icon: icon(Calculator, 16) },
        { label: "Refinance Calculator", href: "/refinance-calculator", icon: icon(Calculator, 16) },
        { label: "ARM Calculator", href: "/adjustable-rate-calculator", icon: icon(Calculator, 16) },
        { label: "Affordability Calculator", href: "/affordability-calculator", icon: icon(Calculator, 16) },
        { label: "Down Payment Calculator", href: "/down-payment-calculator", icon: icon(Calculator, 16) },
        { label: "Rent vs Buy", href: "/rent-vs-buy-calculator", icon: icon(Calculator, 16) },
        { label: "Closing Cost Estimator", href: "/closing-cost-estimator", icon: icon(Calculator, 16) },
        { label: "Cash Flow Calculator", href: "/cash-flow-calculator", icon: icon(Calculator, 16) },
        { label: "Cap Rate & ROI", href: "/cap-rate-calculator", icon: icon(Calculator, 16) },
        { label: "Home Value Estimator", href: "/home-value-estimator", icon: icon(Home, 16) },
      ],
    },
    {
      label: "Analyzers & AI",
      icon: icon(Sparkles),
      items: [
        { label: "Property Investment Analyzer", href: "/property-investment-analyzer", icon: icon(Sparkles, 16) },
        { label: "Rental Property Analyzer", href: "/rental-property-analyzer", icon: icon(Sparkles, 16) },
        { label: "AI Deal Analyzer", href: "/ai-real-estate-deal-analyzer", icon: icon(Sparkles, 16) },
        { label: "AI CMA Analyzer", href: "/ai-cma-analyzer", icon: icon(Sparkles, 16) },
        { label: "AI Zillow / Redfin Analyzer", href: "/ai-zillow-redfin-link-analyzer", icon: icon(Sparkles, 16) },
        { label: "Smart CMA Builder", href: "/smart-cma-builder", icon: icon(FileText, 16) },
        { label: "Property Report Generator", href: "/property-report", icon: icon(FileText, 16) },
      ],
    },
    {
      label: "For agents",
      icon: icon(Users),
      items: [
        { label: "Home Value Leads", href: "/agent-home-value-leads", icon: icon(Users, 16) },
        {
          label: "AI Comparison Report",
          href: "/dashboard/comparison-report",
          prefetch: false,
          icon: icon(Sparkles, 16),
        },
      ],
    },
  ],
} satisfies NavConfig;

export const leadSmartMarketingNav = marketingNavConfig.sections;

export default marketingNavConfig;
