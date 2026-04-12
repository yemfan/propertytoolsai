import { getCurrentAgentContext } from "@/lib/dashboardService";
import { SendClient } from "./SendClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Send",
  description: "Send messages and campaigns to your contacts.",
  keywords: ["send", "email", "outreach"],
  robots: { index: false },
};

export default async function SendPage() {
  const { agentId } = await getCurrentAgentContext();

  return <SendClient agent={agentId} />;
}

