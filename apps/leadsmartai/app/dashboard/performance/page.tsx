import { redirect } from "next/navigation";

/**
 * Performance merged into the Boss Assistant command center — the
 * revenue/commission, pipeline-forecast, and email-engagement panels
 * live in its collapsed "Business performance" section now. Kept as a
 * redirect for old links.
 */
export default function PerformancePage() {
  redirect("/dashboard/boss");
}
