import { redirect } from "next/navigation";
import { getPropertyToolsConsumerPostLoginUrl } from "@/lib/propertyToolsConsumerUrl";
import { resolveRoleHomePath } from "@/lib/rolePortalPaths";
import { fetchUserPortalContext } from "@/lib/rolePortalServer";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { consumerShouldUsePropertyToolsApp } from "@/lib/signupOriginApp";

/**
 * Post-login landing: professionals → CRM; PropertyTools-origin consumers → PropertyTools app;
 * LeadSmart-origin consumers → marketing home on this site.
 */
export default async function DashboardRouterPage() {
  const supabase = supabaseServerClient();
  const ctx = await fetchUserPortalContext(supabase);
  if (!ctx) {
    redirect("/login");
  }
  if (!ctx.isPro) {
    if (consumerShouldUsePropertyToolsApp(ctx.signupOriginApp)) {
      redirect(getPropertyToolsConsumerPostLoginUrl());
    }
    redirect("/");
  }
  redirect(resolveRoleHomePath(ctx.role, ctx.hasAgentRow));
}
