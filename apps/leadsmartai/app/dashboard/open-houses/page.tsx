import type { Metadata } from "next";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { listOpenHousesForAgent } from "@/lib/open-houses/service";
import { OpenHousesListClient } from "./OpenHousesListClient";

export const metadata: Metadata = {
  title: "Open Houses",
  description:
    "Schedule open houses, capture visitors via QR sign-in, and run follow-up automation.",
  keywords: ["open houses", "events", "lead capture", "sign-in"],
  robots: { index: false },
};

export default async function OpenHousesPage() {
  const { agentId } = await getCurrentAgentContext();
  const openHouses = await listOpenHousesForAgent(String(agentId));
  return <OpenHousesListClient initialOpenHouses={openHouses} />;
}
