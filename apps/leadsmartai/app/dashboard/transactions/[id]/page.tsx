import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { getTransactionWithChildren } from "@/lib/transactions/service";
import { TransactionDetailClient } from "./TransactionDetailClient";

export const metadata: Metadata = {
  title: "Transaction",
  robots: { index: false },
};

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { agentId } = await getCurrentAgentContext();
  const bundle = await getTransactionWithChildren(String(agentId), id);
  if (!bundle) notFound();
  return (
    <TransactionDetailClient
      initial={bundle}
    />
  );
}
