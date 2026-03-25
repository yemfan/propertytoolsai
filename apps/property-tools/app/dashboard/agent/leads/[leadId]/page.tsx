import { requireRolePage } from "@/lib/auth/requireRolePage";
import LeadDetailClient from "./LeadDetailClient";

export default async function LeadDetailPage() {
  await requireRolePage(["agent", "admin"]);
  return <LeadDetailClient />;
}
