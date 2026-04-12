import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Cap Rate vs Cash-on-Cash Return",
  description: "Understand the key differences between cap rate and cash-on-cash return for investment analysis.",
  keywords: ["cap rate vs cash on cash", "investment metrics", "real estate comparison", "return analysis"],
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
