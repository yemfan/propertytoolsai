import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Broker Calendar",
  description: "Schedule and manage your loan broker appointments.",
  keywords: ["calendar", "appointments", "loan broker"],
  robots: { index: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
