import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "How Cap Rate Affects Property Value",
  description: "Learn the inverse relationship between cap rates and property values in real estate investing.",
  keywords: ["cap rate property value", "valuation", "inverse relationship", "real estate pricing"],
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
