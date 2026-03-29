import { getCurrentAgentContext } from "@/lib/dashboardService";
import { SendClient } from "./SendClient";

export default async function SendPage() {
  const { agentId } = await getCurrentAgentContext();

  return <SendClient agent={agentId} />;
}

