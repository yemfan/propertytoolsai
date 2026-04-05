import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cap Rate vs Cash on Cash Return",
  description: "Compare cap rate vs cash-on-cash return for rental investments. Understand the difference and when to use each metric.",
  keywords: ["cap rate", "cash on cash return", "rental property", "investment metrics", "real estate"],
};

export default function CapRateCashOnCashLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
