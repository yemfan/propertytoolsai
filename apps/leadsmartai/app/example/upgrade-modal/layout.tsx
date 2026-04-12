import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Upgrade Modal Example",
  description: "Example upgrade modal component.",
  keywords: ["example", "modal"],
  robots: { index: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
