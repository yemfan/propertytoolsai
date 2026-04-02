import { redirect } from "next/navigation";
import { getPropertyToolsConsumerPostLoginUrl } from "@/lib/propertyToolsConsumerUrl";
import { resolveRoleHomePath } from "@/lib/rolePortalPaths";
import { fetchUserPortalContext } from "@/lib/rolePortalServer";
import { supabaseServerClient } from "@/lib/supabaseServerClient";

/**
 * Post-login landing: professionals → CRM; consumers → PropertyToolsAI consumer app (not LeadSmart).
 */
export default async function DashboardRouterPage() {
  const supabase = supabaseServerClient();
  const ctx = await fetchUserPortalContext(supabase);
  if (!ctx) {
    redirect("/login");
  }
  if (!ctx.isPro) {
    redirect(getPropertyToolsConsumerPostLoginUrl());
  }
  redirect(resolveRoleHomePath(ctx.role, ctx.hasAgentRow));
}
