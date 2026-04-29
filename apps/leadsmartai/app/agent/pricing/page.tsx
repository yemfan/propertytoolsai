import type { Metadata } from "next";
import AgentPricingClientPage from "./page.client";

export const metadata: Metadata = {
  title: "Agent plans & pricing — Starter, Pro, Premium, Team",
  description:
    "LeadSmart AI plans for real estate agents: Starter (free), Pro ($49/mo, Producer Track coaching), Premium ($99/mo, Top Producer Track), and Team ($199/mo, up to 5 seats). 14-day trial on every paid tier.",
  keywords: [
    "real estate CRM pricing",
    "real estate AI pricing",
    "leadsmart pricing",
    "real estate coaching pricing",
    "agent CRM cost",
  ],
  alternates: { canonical: "/agent/pricing" },
  openGraph: {
    title: "Agent plans & pricing | LeadSmart AI",
    description:
      "Pro from $49/mo with Producer Track coaching. Premium $99/mo with Top Producer Track. Team $199/mo for up to 5 seats. 14-day trial.",
    url: "/agent/pricing",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Agent plans & pricing | LeadSmart AI",
    description:
      "Pro from $49/mo with Producer Track coaching. Premium $99/mo with Top Producer Track. Team $199/mo for up to 5 seats.",
  },
};

/**
 * JSON-LD payload — emitted server-side as one Product per plan
 * tier so search engines can render rich pricing snippets. Pricing
 * lives here (not in a shared registry) because the marketing copy
 * is intentionally separate from the entitlement-gating tier names
 * in lib/entitlements/planCatalog.ts.
 */
const PRICING_PRODUCTS = [
  {
    name: "Starter",
    description: "For new agents testing the platform — up to 5 leads, 50 contacts, basic AI follow-up.",
    price: "0",
  },
  {
    name: "Pro",
    description:
      "For active agents closing deals consistently. Includes Producer Track coaching, video email, BBA workflow, and sphere + equity signals.",
    price: "49",
  },
  {
    name: "Premium",
    description:
      "For top producers running solo. Unlimited leads, Top Producer Track coaching, ISA workflow, and e-signature.",
    price: "99",
  },
  {
    name: "Team",
    description:
      "For brokerages and small teams up to 5 seats. Top Producer Track for every member, round-robin lead routing, roster-wide rollups.",
    price: "199",
  },
] as const;

/**
 * Agent pricing page — public marketing surface AND in-product
 * upgrade page in one. The client component renders different copy
 * based on the result of /api/agent/access-check:
 *   - Logged-out / no entitlement → "Choose a plan to get started"
 *   - Logged-in agent → current plan badge + upgrade options
 *
 * Was previously a redirect to /dashboard/billing, but that meant
 * marketing CTAs from the public site couldn't link here. Removed
 * the redirect so this is a real page; the proxy + agent layout
 * already allowlist /agent/pricing as a public path so logged-out
 * visitors don't bounce.
 */
export default function AgentPricingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": PRICING_PRODUCTS.map((p) => ({
              "@type": "Product",
              name: `LeadSmart AI ${p.name}`,
              description: p.description,
              brand: { "@type": "Brand", name: "LeadSmart AI" },
              category: "Real estate CRM",
              offers: {
                "@type": "Offer",
                price: p.price,
                priceCurrency: "USD",
                availability: "https://schema.org/InStock",
                priceSpecification: {
                  "@type": "UnitPriceSpecification",
                  price: p.price,
                  priceCurrency: "USD",
                  unitText: "MONTH",
                },
                url: "https://leadsmart-ai.com/agent/pricing",
              },
            })),
          }),
        }}
      />
      <AgentPricingClientPage />
    </>
  );
}
