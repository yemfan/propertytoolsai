import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "What is Cap Rate",
  description: "Complete guide to cap rate (capitalization rate). Learn the definition, formula, and importance for real estate investing.",
  keywords: ["what is cap rate", "capitalization rate", "definition", "real estate", "investment basics"],
};

export default function WhatIsCapRateLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
