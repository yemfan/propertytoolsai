import type { Metadata } from "next";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { listTransactionsForAgent } from "@/lib/transactions/service";
import { TransactionsListClient } from "./TransactionsListClient";

export const metadata: Metadata = {
  title: "Transactions",
  description: "Active closings with deadlines, tasks, and counterparties.",
  robots: { index: false },
};

export default async function TransactionsPage() {
  const { agentId } = await getCurrentAgentContext();
  const transactions = await listTransactionsForAgent(String(agentId));
  return <TransactionsListClient initialItems={transactions} />;
}
