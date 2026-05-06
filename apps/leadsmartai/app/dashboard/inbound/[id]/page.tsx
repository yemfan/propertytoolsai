import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { getInboundDeliveryForAgent } from "@/lib/inbound/deliveries";
import { intentLabel } from "@/lib/inbound/intent";
import InboundDeliveryClient from "./InboundDeliveryClient";

export const metadata: Metadata = {
  title: "Forwarded email",
  robots: { index: false },
};

export default async function InboundDeliveryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getCurrentAgentContext();
  const { id } = await params;

  const delivery = await getInboundDeliveryForAgent(String(ctx.agentId), id);
  if (!delivery) notFound();

  return (
    <InboundDeliveryClient
      delivery={delivery}
      intentLabel={intentLabel(delivery.intent)}
    />
  );
}
