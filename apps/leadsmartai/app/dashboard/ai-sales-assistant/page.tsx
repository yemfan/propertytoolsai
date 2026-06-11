import type { Metadata } from "next";
import SalesAssistantClient from "./SalesAssistantClient";

export const metadata: Metadata = {
  title: "AI Sales Assistant",
  description: "Lead follow-up, reactivation, and appointment booking by your AI Sales Assistant.",
  robots: { index: false },
};

export default function AiSalesAssistantPage() {
  return <SalesAssistantClient />;
}
