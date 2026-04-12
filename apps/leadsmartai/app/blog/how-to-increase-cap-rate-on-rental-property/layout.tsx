import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "How to Increase Cap Rate on Rental Property",
  description: "Proven strategies to boost your rental property cap rate through income growth and expense reduction.",
  keywords: ["increase cap rate", "improve returns", "rental optimization", "NOI improvement"],
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
