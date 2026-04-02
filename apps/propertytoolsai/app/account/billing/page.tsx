import { requireRole } from "@/lib/auth/requireRole";
import { USER_ROLES } from "@/lib/auth/roles";
import AccountBillingClientPage from "./page.client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Billing | PropertyTools AI",
  description:
    "View your PropertyTools AI subscription, compare plans, and open the Stripe portal for invoices and payment methods.",
};

/** Billing is available to every authenticated role (see `USER_ROLES`). */
export default async function AccountBillingPage() {
  await requireRole([...USER_ROLES]);
  return <AccountBillingClientPage />;
}
