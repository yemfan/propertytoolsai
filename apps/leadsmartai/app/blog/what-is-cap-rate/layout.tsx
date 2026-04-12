import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "What Is Cap Rate in Real Estate?",
  description: "A clear explanation of capitalization rate and why it matters for real estate investors.",
  keywords: ["what is cap rate", "capitalization rate", "real estate basics", "investment fundamentals"],
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
