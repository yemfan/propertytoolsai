import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "How Cap Rate Changes in Different Markets",
  description: "Explore why cap rates vary across real estate markets and what drives the differences.",
  keywords: ["cap rate by market", "market comparison", "regional cap rates", "real estate trends"],
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
