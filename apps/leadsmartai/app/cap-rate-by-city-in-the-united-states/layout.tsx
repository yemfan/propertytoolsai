import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cap Rate By City in the United States",
  description: "Compare cap rates across US cities and markets. Find average capitalization rates by location for real estate investment analysis.",
  keywords: ["cap rate", "by city", "market data", "real estate", "investment comparison"],
};

export default function CapRateByCityLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
