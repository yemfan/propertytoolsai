import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "How to Calculate Cap Rate",
  description: "Master the cap rate calculation with our step-by-step guide and real property examples.",
  keywords: ["calculate cap rate", "cap rate formula", "NOI calculation", "real estate math"],
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
