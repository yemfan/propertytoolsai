import type { Metadata } from "next";
import PropertyToolsHomePage from "@/components/landing/PropertyToolsHomePage";
import { ExitIntentPopupLoader } from "@/components/marketing/ExitIntentPopupLoader";

export const metadata: Metadata = {
  title: "PropertyTools AI — Free AI Real Estate Tools",
  description:
    "Instantly check your home value, compare properties, and estimate your mortgage — free AI-powered tools for buyers, sellers, and investors.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "PropertyTools AI — Smarter Tools to Buy, Sell, or Finance a Home",
    description:
      "Home value estimator, mortgage calculator, AI property comparison, and refinance analyzer — start free.",
  },
};

export default function HomePage() {
  return (
    <>
      <PropertyToolsHomePage />
      <ExitIntentPopupLoader />
    </>
  );
}
