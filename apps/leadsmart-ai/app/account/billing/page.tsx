import { redirect } from "next/navigation";

/** Canonical subscription UI today — replace with a dedicated billing portal when added. */
export default function AccountBillingPage() {
  redirect("/dashboard/settings");
}
