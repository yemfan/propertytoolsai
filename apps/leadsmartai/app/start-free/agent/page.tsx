import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { resolveRoleHomePath } from "@/lib/rolePortalPaths";
import StartFreeAgentClientPage from "./page.client";

export const metadata = {
  title: "Start as Agent | LeadSmart AI",
  description: "Activate LeadSmart AI Agent Starter — CMA, leads, CRM, and alerts in one workspace.",
};

function signedInDashboardHref(user: NonNullable<Awaited<ReturnType<typeof getCurrentUserWithRole>>>): string {
  const r = String(user.role ?? "").toLowerCase().trim();
  if (r === "consumer" || r === "user" || r === "") {
    return "/client/dashboard";
  }
  return resolveRoleHomePath(user.role, user.hasAgentRow);
}

export default async function StartFreeAgentPage() {
  const user = await getCurrentUserWithRole();

  if (!user) {
    redirect("/login?next=/start-free/agent");
  }

  return <StartFreeAgentClientPage backHref={signedInDashboardHref(user)} />;
}
