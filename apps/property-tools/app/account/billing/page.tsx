import { requireRole } from "@/lib/auth/requireRole";
import { USER_ROLES } from "@/lib/auth/roles";
import AccountBillingClientPage from "./page.client";

export const dynamic = "force-dynamic";

/** Billing is available to every authenticated role (see `USER_ROLES`). */
export default async function AccountBillingPage() {
  await requireRole([...USER_ROLES]);
  return <AccountBillingClientPage />;
}
