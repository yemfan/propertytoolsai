import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "What Is a Good Cap Rate for Rental Property?",
  description: "Find out what cap rate range to target for rental property investments in todays market.",
  keywords: ["good cap rate", "rental property", "target returns", "investment benchmarks"],
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
