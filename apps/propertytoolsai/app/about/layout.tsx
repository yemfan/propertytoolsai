import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "About PropertyTools AI | Smarter Real Estate Decisions",
  description:
    "PropertyTools AI helps you understand property value, financing, and investment potential with fast, intelligent tools.",
  openGraph: {
    title: "About PropertyTools AI | Smarter Real Estate Decisions",
    description:
      "PropertyTools AI helps you understand property value, financing, and investment potential with fast, intelligent tools.",
  },
};

export default function AboutLayout({ children }: { children: ReactNode }) {
  return children;
}
