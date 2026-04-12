import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Cap Rate vs ROI",
  description: "Compare cap rate and ROI to understand which metric better evaluates your real estate investment.",
  keywords: ["cap rate vs ROI", "return on investment", "investment metrics", "property analysis"],
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
