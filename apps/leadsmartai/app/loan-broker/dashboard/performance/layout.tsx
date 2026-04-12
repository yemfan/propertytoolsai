import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Broker Performance",
  description: "Analyze your loan origination metrics and performance.",
  keywords: ["performance", "analytics", "loan broker"],
  robots: { index: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
