import type { Metadata } from "next";

import ConsumerPricingClientPage from "./page.client";
import { redirectAdminSupportAwayFromCommercialPricing } from "@/lib/auth/redirectStaffFromCommercialPricing";
import JsonLd from "@/components/JsonLd";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return {
    title: t("pricing.title", { ns: "web_marketing" }),
    description: t("pricing.description", { ns: "web_marketing" }),
    alternates: {
      canonical: "/pricing",
    },
  };
}

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
                name: "Starter Plan",
                price: "0",
                priceCurrency: "USD",
                priceValidUntil: "2027-12-31",
                description:
                  "Limited functions and usages. Up to 5 leads, 50 contacts.",
                url: "https://leadsmart-ai.com/signup",
              },
              {
                "@type": "Offer",
                name: "Pro Plan (monthly)",
                price: "49",
                priceCurrency: "USD",
                priceValidUntil: "2027-12-31",
                billingIncrement: "P1M",
                description:
                  "Full CRM and AI for active agents. Producer Track coaching, bilingual English / 中文 AI.",
                url: "https://leadsmart-ai.com/pricing",
              },
              {
                "@type": "Offer",
                name: "Pro Plan (annual)",
                price: "490",
                priceCurrency: "USD",
                priceValidUntil: "2027-12-31",
                billingIncrement: "P1Y",
                description: "Pro tier billed annually — save 2 months vs monthly.",
                url: "https://leadsmart-ai.com/agent/pricing",
              },
              {
                "@type": "Offer",
                name: "Premium Plan (monthly)",
                price: "99",
                priceCurrency: "USD",
                priceValidUntil: "2027-12-31",
                billingIncrement: "P1M",
                description:
                  "For top producers closing 10+ deals/month. Top Producer Track coaching, unlimited everything.",
                url: "https://leadsmart-ai.com/pricing",
              },
              {
                "@type": "Offer",
                name: "Premium Plan (annual)",
                price: "990",
                priceCurrency: "USD",
                priceValidUntil: "2027-12-31",
                billingIncrement: "P1Y",
                description: "Premium tier billed annually — save 2 months vs monthly.",
                url: "https://leadsmart-ai.com/agent/pricing",
              },
              {
                "@type": "Offer",
                name: "Signature Plan (monthly)",
                price: "249",
                priceCurrency: "USD",
                priceValidUntil: "2027-12-31",
                billingIncrement: "P1M",
                description:
                  "Relationship-driven agents serving high-value clients. Sphere Intelligence Pro, white-glove onboarding, concierge support, cultural calendar automations, custom voice tuning.",
                url: "https://leadsmart-ai.com/agent/pricing",
              },
              {
                "@type": "Offer",
                name: "Signature Plan (annual)",
                price: "2490",
                priceCurrency: "USD",
                priceValidUntil: "2027-12-31",
                billingIncrement: "P1Y",
                description: "Signature tier billed annually — save 2 months vs monthly.",
                url: "https://leadsmart-ai.com/agent/pricing",
              },
              {
                "@type": "Offer",
                name: "Team Plan (monthly)",
                price: "299",
                priceCurrency: "USD",
                priceValidUntil: "2027-12-31",
                billingIncrement: "P1M",
                description:
                  "Brokerages and small teams. Round-robin lead routing, per-member reporting, Top Producer Track for every seat.",
                url: "https://leadsmart-ai.com/contact",
              },
              {
                "@type": "Offer",
                name: "Team Plan (annual)",
                price: "2990",
                priceCurrency: "USD",
                priceValidUntil: "2027-12-31",
                billingIncrement: "P1Y",
                description: "Team tier billed annually — save 2 months vs monthly.",
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
