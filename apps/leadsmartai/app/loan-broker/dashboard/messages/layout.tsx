import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Broker Messages",
  description: "View and respond to client messages.",
  keywords: ["messages", "communication", "loan broker"],
  robots: { index: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
