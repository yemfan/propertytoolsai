import type { Metadata } from "next";
import LeadSmartLanding from "@/components/marketing/LeadSmartLanding";

export const metadata: Metadata = {
  title: "LeadSmart AI — The AI Deal Engine for Real Estate",
  description:
    "We don’t just generate leads — we turn them into closed deals, automatically. Capture, qualify, and convert buyers and sellers with AI. Focus on closing, not chasing.",
  openGraph: {
    title: "LeadSmart AI — The AI Deal Engine for Real Estate",
    description:
      "High-intent buyers and sellers, captured and converted with AI. No setup required — works in minutes.",
  },
};

export default function HomePage() {
  return <LeadSmartLanding />;
}
