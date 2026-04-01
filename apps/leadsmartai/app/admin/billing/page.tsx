import { requireRole } from "@/lib/auth/requireRole";
import AdminBillingClientPage from "./page.client";

export const metadata = {
  title: "Subscription & Billing | Admin | LeadSmart AI",
  description: "Manage plans, billing status, and MRR.",
};

export default async function AdminBillingPage() {
  await requireRole(["admin"], { strictUnauthorized: true });
  return <AdminBillingClientPage />;
}
