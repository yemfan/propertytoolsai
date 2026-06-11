import type { Metadata } from "next";
import ReceptionistClient from "./ReceptionistClient";

export const metadata: Metadata = {
  title: "AI Receptionist",
  description: "Inbound calls answered, leads captured, and missed calls recovered by your AI Receptionist.",
  robots: { index: false },
};

export default function AiReceptionistPage() {
  return <ReceptionistClient />;
}
