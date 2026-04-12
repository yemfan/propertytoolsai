import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Broker Settings",
  description: "Configure your loan broker account and preferences.",
  keywords: ["settings", "preferences", "loan broker"],
  robots: { index: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
