import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Cap Rate vs Gross Rent Multiplier",
  description: "Compare cap rate and GRM to decide which metric works best for your investment strategy.",
  keywords: ["cap rate vs GRM", "gross rent multiplier", "investment metrics", "property valuation"],
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
