import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How Cap Rate Changes in Different Markets",
  description: "Explore cap rate variations across different real estate markets. Understand market factors affecting capitalization rates.",
  keywords: ["cap rate markets", "market comparison", "regional cap rates", "real estate", "market analysis"],
};

export default function CapRateMarketChangesLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
