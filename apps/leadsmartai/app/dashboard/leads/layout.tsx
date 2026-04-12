import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Leads",
  description: "Manage your lead pipeline, follow-ups, and CRM.",
  keywords: ["leads", "CRM", "pipeline", "follow-ups"],
  robots: { index: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
