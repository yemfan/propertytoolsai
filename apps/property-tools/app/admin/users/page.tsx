import { requireRole } from "@/lib/auth/requireRole";
import AdminUsersClient from "./AdminUsersClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireRole(["admin"]);
  return <AdminUsersClient />;
}
