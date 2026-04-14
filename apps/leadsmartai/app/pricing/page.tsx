import ConsumerPricingClientPage from "./page.client";
import { redirectAdminSupportAwayFromCommercialPricing } from "@/lib/auth/redirectStaffFromCommercialPricing";
import JsonLd from "@/components/JsonLd";

export const metadata = {
  title: "Pricing | LeadSmart AI",
  description:
    "Free, Pro ($49), Elite ($99), and Team ($199) plans — full feature comparison for AI lead management, CRM, and automation.",
  alternates: {
    canonical: "/pricing",
  },
};

export default async function ConsumerPricingPage() {
  await redirectAdminSupportAwayFromCommercialPricing();
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "LeadSmart AI",
          description:
            "AI-powered CRM and lead management platform for real estate professionals. Capture, qualify, and convert leads with intelligent automation.",
          url: "https://leadsmart-ai.com/pricing",
          applicationCategory: "BusinessApplication",
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "USD",
            offers: [
              {
                "@type": "Offer",
                name: "Free Plan",
                price: "0",
                priceCurrency: "USD",
                priceValidUntil: "2026-12-31",
                description:
                  "Test the platform. See leads flow in. 25 leads per month.",
                url: "https://leadsmart-ai.com/signup",
              },
              {
                "@type": "Offer",
                name: "Pro Plan",
                price: "49",
                priceCurrency: "USD",
                priceValidUntil: "2026-12-31",
                billingIncrement: "P1M",
                description:
                  "Full CRM and AI for active agents. 500 leads per month.",
                url: "https://leadsmart-ai.com/pricing",
              },
              {
                "@type": "Offer",
                name: "Elite Plan",
                price: "99",
                priceCurrency: "USD",
                priceValidUntil: "2026-12-31",
                billingIncrement: "P1M",
                description:
                  "For top producers closing 10+ deals/month. Unlimited leads per month.",
                url: "https://leadsmart-ai.com/pricing",
              },
              {
                "@type": "Offer",
                name: "Team Plan",
                price: "199",
                priceCurrency: "USD",
                priceValidUntil: "2026-12-31",
                billingIncrement: "P1M",
                description:
                  "Multiple agents, one shared pipeline. Unlimited leads per month.",
                url: "https://leadsmart-ai.com/contact",
              },
            ],
          },
        }}
      />
      <ConsumerPricingClientPage />
    </>
  );
}
