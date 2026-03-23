import { redirect } from "next/navigation";
import { resolveRoleHomePath } from "@/lib/rolePortalPaths";
import { fetchUserPortalContext } from "@/lib/rolePortalServer";
import { supabaseServerClient } from "@/lib/supabaseServerClient";

/**
 * Post-login landing: sends users to the right dashboard (or client home for consumers).
 */
export default async function DashboardRouterPage() {
  const supabase = supabaseServerClient();
  const ctx = await fetchUserPortalContext(supabase);
  if (!ctx) {
    redirect("/login");
  }
  if (!ctx.isPro) {
    redirect("/client/dashboard");
  }
  redirect(resolveRoleHomePath(ctx.role, ctx.hasAgentRow));
}
