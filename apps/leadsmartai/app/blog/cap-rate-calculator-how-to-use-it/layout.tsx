import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "How to Use a Cap Rate Calculator",
  description: "Step-by-step guide to using a cap rate calculator for evaluating real estate investment returns.",
  keywords: ["cap rate calculator", "how to use", "real estate returns", "investment analysis"],
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
