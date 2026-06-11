import type { Metadata } from "next";
import TransactionAssistantClient from "./TransactionAssistantClient";

export const metadata: Metadata = {
  title: "AI Transaction Assistant",
  description: "Deadline tracking, document reminders, and risk alerts for your active transactions.",
  robots: { index: false },
};

export default function AiTransactionAssistantPage() {
  return <TransactionAssistantClient />;
}
