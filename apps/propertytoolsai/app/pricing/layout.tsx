import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Free & Premium Plans",
  description:
    "Choose PropertyTools AI free plan with limits or upgrade to Premium for unlimited access to all tools and features.",
  keywords: [
    "pricing",
    "plans",
    "premium",
    "subscription",
    "real estate tools pricing",
  ],
  openGraph: {
    title: "Pricing — Free & Premium Plans",
    description:
      "Choose PropertyTools AI free plan with limits or upgrade to Premium for unlimited access to all tools and features.",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
