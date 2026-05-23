import type { NavConfig } from "@repo/ui";
import { BookOpen, Calculator, FileText, HelpCircle, Home, LayoutDashboard, LifeBuoy, Mail, MessageCircle, MonitorPlay, Phone, Plug, Search, Sparkles, Users, Wand2 } from "lucide-react";

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
      label: "Homes for sale",
      href: "/homes",
      match: ["/homes", "/homes/search", "/homes/[id]"],
      icon: <Search size={18} strokeWidth={2} aria-hidden />,
    },
    {
      label: "Test-drive our voice AI",
      href: "/voice-ai-test-drive",
      match: ["/voice-ai-test-drive"],
      icon: <Phone size={18} strokeWidth={2} aria-hidden />,
    },
    {
      // Live read-only sandbox of the dashboard — first competitor in
      // the category to offer a no-signup interactive demo of the
      // full workspace. /try-demo is the marketing entry; /demo is
      // the actual sandbox.
      label: "Live demo",
      href: "/try-demo",
      match: ["/try-demo", "/demo", "/demo/[...rest]"],
      icon: <MonitorPlay size={18} strokeWidth={2} aria-hidden />,
    },
    {
      // Free tools — replaces the older "Calculators & estimators"
      // submenu as the primary discoverability surface for our
      // calculator + analyzer suite. The old submenu stays below
      // for power-users who jump directly to a specific tool.
      label: "Free tools",
      href: "/free-tools",
      match: ["/free-tools"],
      icon: <Wand2 size={18} strokeWidth={2} aria-hidden />,
    },
    {
      // Blog + Help promoted to top-level so visitors can find them
      // without expanding the Site submenu. Both are major marketing
      // surfaces (blog index has multiple articles, help center
      // has 30+ how-to guides), and burying them inside a collapsed
      // submenu meant they were essentially invisible to first-time
      // visitors.
      label: "Blog",
      href: "/blog",
      match: ["/blog", "/blog/[slug]"],
      icon: <BookOpen size={18} strokeWidth={2} aria-hidden />,
    },
    {
      label: "Help center",
      href: "/help",
      match: ["/help", "/help/faq", "/help/guides/[slug]"],
      icon: <LifeBuoy size={18} strokeWidth={2} aria-hidden />,
    },
    {
      label: "Integrations",
      href: "/integrations",
      match: ["/integrations"],
      icon: <Plug size={18} strokeWidth={2} aria-hidden />,
    },
    {
      label: "Site",
      icon: <LayoutDashboard size={18} strokeWidth={2} aria-hidden />,
      items: [
        { label: "About", href: "/about", icon: <FileText size={16} strokeWidth={2} aria-hidden /> },
        { label: "Contact", href: "/contact", icon: <Mail size={16} strokeWidth={2} aria-hidden /> },
        { label: "Support chat", href: "/support", icon: <MessageCircle size={16} strokeWidth={2} aria-hidden /> },
        { label: "FAQ", href: "/help/faq", icon: <HelpCircle size={16} strokeWidth={2} aria-hidden /> },
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
