import type { Metadata } from "next";
import LeadSmartLanding from "@/components/marketing/LeadSmartLanding";

export const metadata: Metadata = {
  title: "LeadSmart AI — AI Growth Engine for Agents & Mortgage Pros",
  description:
    "Turn online traffic into closed deals — automatically. AI captures, qualifies, and follows up with your leads instantly. First qualified lead in 24 hours or it’s free.",
  openGraph: {
    title: "LeadSmart AI — Turn traffic into closed deals, automatically",
    description:
      "Stop chasing cold leads. High-intent buyers and sellers, captured and nurtured by AI. Built for agents and brokers.",
  },
};

export default function HomePage() {
  return <LeadSmartLanding />;
}
