import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Listing Analyzer — Zillow & Redfin Link Analysis",
  description:
    "Analyze Zillow and Redfin listings with AI-powered investment metrics, cap rate, cash flow, and deal scoring.",
  keywords: [
    "listing analyzer",
    "Zillow analysis",
    "Redfin analysis",
    "deal scoring",
    "investment analysis",
    "cap rate calculator",
  ],
};

export default function AIZillowRedfinLinkAnalyzerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
