import { requireRolePage } from "@/lib/auth/requireRolePage";
import { PlatformOverviewClient } from "./PlatformOverviewClient";

export const dynamic = "force-dynamic";

export default async function AdminPlatformOverviewPage() {
  await requireRolePage(["admin"]);

  return <PlatformOverviewClient />;
}
