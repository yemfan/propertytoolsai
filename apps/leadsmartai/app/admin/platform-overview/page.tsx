import { requireRole } from "@/lib/auth/requireRole";
import { PlatformOverviewClient } from "./PlatformOverviewClient";

export const metadata = {
  title: "Platform Overview | LeadSmart AI",
  description: "Business performance across PropertyToolsAI and LeadSmart AI.",
};

export default async function PlatformOverviewPage() {
  await requireRole(["admin"]);

  return <PlatformOverviewClient />;
}
