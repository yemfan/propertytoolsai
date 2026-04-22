import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Growth & Opportunities",
  description:
    "AI-generated growth opportunities plus traffic + referral metrics. Claude reads your pipeline and surfaces the highest-leverage actions to take this week.",
  keywords: ["growth", "opportunities", "AI", "referrals", "traffic"],
  robots: { index: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
