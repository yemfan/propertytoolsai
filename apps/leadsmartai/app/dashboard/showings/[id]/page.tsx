import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { getShowingWithFeedback } from "@/lib/showings/service";
import { ShowingDetailClient } from "./ShowingDetailClient";

export const metadata: Metadata = {
  title: "Showing",
  robots: { index: false },
};

type PageProps = { params: Promise<{ id: string }> };

export default async function ShowingDetailPage({ params }: PageProps) {
  const { agentId } = await getCurrentAgentContext();
  const { id } = await params;
  const result = await getShowingWithFeedback(String(agentId), id);
  if (!result) notFound();
  return (
    <ShowingDetailClient
      showing={result.showing}
      feedback={result.feedback}
      contactName={result.contactName}
      siblings={result.siblingShowings}
    />
  );
}
