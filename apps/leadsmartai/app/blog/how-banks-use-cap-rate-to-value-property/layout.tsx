import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "How Banks Use Cap Rate to Value Property",
  description: "Discover how lenders and banks use capitalization rates to appraise commercial real estate.",
  keywords: ["banks cap rate", "property valuation", "commercial appraisal", "lending"],
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
