import { requireRolePage } from "@/lib/auth/requireRolePage";
import { SupportDashboardClient } from "./SupportDashboardClient";

export const dynamic = "force-dynamic";

export default async function SupportDashboardPage() {
  await requireRolePage(["support", "admin"]);

  return <SupportDashboardClient />;
}
