import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Consumer Pricing",
  description: "View pricing for home buyers and sellers.",
  keywords: ["pricing", "consumer"],
  robots: { index: false },
};

/** Canonical consumer pricing lives at `/pricing`. */
export default function PricingConsumerRedirectPage() {
  redirect("/pricing");
}
