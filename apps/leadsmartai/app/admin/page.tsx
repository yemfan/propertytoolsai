import { redirect } from "next/navigation";

/** Admin hub is the support dashboard only. */
export default function AdminPortalPage() {
  redirect("/admin/support");
}
