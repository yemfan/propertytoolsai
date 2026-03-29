import type { NavConfig } from "@repo/ui";
import { Calculator, FileText, Home, LayoutDashboard, Mail, MessageCircle, Sparkles, Users } from "lucide-react";

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
      icon: <Home size={18} strokeWidth={2} aria-hidden />,
    },
    {
      label: "Site",
      icon: <LayoutDashboard size={18} strokeWidth={2} aria-hidden />,
      items: [
        { label: "About", href: "/about", icon: <FileText size={16} strokeWidth={2} aria-hidden /> },
        { label: "Contact", href: "/contact", icon: <Mail size={16} strokeWidth={2} aria-hidden /> },
        { label: "Support chat", href: "/support", icon: <MessageCircle size={16} strokeWidth={2} aria-hidden /> },
      ],
    },
    {
      label: "Calculators & estimators",
      icon: <Calculator size={18} strokeWidth={2} aria-hidden />,
      items: [
        { label: "Mortgage Calculator", href: "/mortgage-calculator", icon: <Calculator size={16} strokeWidth={2} aria-hidden /> },
        { label: "Refinance Calculator", href: "/refinance-calculator", icon: <Calculator size={16} strokeWidth={2} aria-hidden /> },
        { label: "ARM Calculator", href: "/adjustable-rate-calculator", icon: <Calculator size={16} strokeWidth={2} aria-hidden /> },
        { label: "Affordability Calculator", href: "/affordability-calculator", icon: <Calculator size={16} strokeWidth={2} aria-hidden /> },
        { label: "Down Payment Calculator", href: "/down-payment-calculator", icon: <Calculator size={16} strokeWidth={2} aria-hidden /> },
        { label: "Rent vs Buy", href: "/rent-vs-buy-calculator", icon: <Calculator size={16} strokeWidth={2} aria-hidden /> },
        { label: "Closing Cost Estimator", href: "/closing-cost-estimator", icon: <Calculator size={16} strokeWidth={2} aria-hidden /> },
        { label: "Cash Flow Calculator", href: "/cash-flow-calculator", icon: <Calculator size={16} strokeWidth={2} aria-hidden /> },
        { label: "Cap Rate & ROI", href: "/cap-rate-calculator", icon: <Calculator size={16} strokeWidth={2} aria-hidden /> },
        { label: "Home Value Estimator", href: "/home-value-estimator", icon: <Home size={16} strokeWidth={2} aria-hidden /> },
      ],
    },
    {
      label: "Analyzers & AI",
      icon: <Sparkles size={18} strokeWidth={2} aria-hidden />,
      items: [
        { label: "Property Investment Analyzer", href: "/property-investment-analyzer", icon: <Sparkles size={16} strokeWidth={2} aria-hidden /> },
        { label: "Rental Property Analyzer", href: "/rental-property-analyzer", icon: <Sparkles size={16} strokeWidth={2} aria-hidden /> },
        { label: "AI Deal Analyzer", href: "/ai-real-estate-deal-analyzer", icon: <Sparkles size={16} strokeWidth={2} aria-hidden /> },
        { label: "AI CMA Analyzer", href: "/ai-cma-analyzer", icon: <Sparkles size={16} strokeWidth={2} aria-hidden /> },
        { label: "AI Zillow / Redfin Analyzer", href: "/ai-zillow-redfin-link-analyzer", icon: <Sparkles size={16} strokeWidth={2} aria-hidden /> },
        { label: "Smart CMA Builder", href: "/smart-cma-builder", icon: <FileText size={16} strokeWidth={2} aria-hidden /> },
        { label: "Property Report Generator", href: "/property-report", icon: <FileText size={16} strokeWidth={2} aria-hidden /> },
      ],
    },
    {
      label: "For agents",
      icon: <Users size={18} strokeWidth={2} aria-hidden />,
      items: [
        { label: "Home Value Leads", href: "/agent-home-value-leads", icon: <Users size={16} strokeWidth={2} aria-hidden /> },
        {
          label: "AI Comparison Report",
          href: "/dashboard/comparison-report",
          prefetch: false,
          icon: <Sparkles size={16} strokeWidth={2} aria-hidden />,
        },
      ],
    },
  ],
} satisfies NavConfig;

export const leadSmartMarketingNav = marketingNavConfig.sections;

export default marketingNavConfig;
