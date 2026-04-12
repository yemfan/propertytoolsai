import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Cap Rate for Multifamily Investments",
  description: "Understand how cap rates apply to multifamily property investments and what rates to expect.",
  keywords: ["multifamily cap rate", "apartment investing", "multifamily investment", "capitalization rate"],
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
