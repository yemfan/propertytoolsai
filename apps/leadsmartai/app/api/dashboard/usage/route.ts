import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  try {
    const { agentId, userId, planType } = await getCurrentAgentContext();

    // Get entitlements
    const { data: entitlement } = await supabaseServer
      .from("product_entitlements")
      .select("max_leads, max_contacts, cma_reports_per_day")
      .eq("user_id", userId)
      .eq("product", "leadsmart")
      .maybeSingle();

    const limits = {
      maxLeads: (entitlement as any)?.max_leads ?? (planType === "free" ? 5 : 500),
      maxContacts: (entitlement as any)?.max_contacts ?? (planType === "free" ? 50 : 5000),
      cmaPerDay: (entitlement as any)?.cma_reports_per_day ?? (planType === "free" ? 2 : 50),
    };

    // Current counts
    const [leadsRes, contactsRes] = await Promise.all([
      supabaseServer
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", agentId as any),
      supabaseServer
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", agentId as any),
    ]);

    // Today's CMA usage
    const today = new Date().toISOString().slice(0, 10);
    const { data: cmaUsage } = await supabaseServer
      .from("cma_daily_usage")
      .select("count")
      .eq("agent_id", agentId as any)
      .eq("usage_date", today)
      .maybeSingle();

    const usage = {
      leads: leadsRes.count ?? 0,
      contacts: contactsRes.count ?? 0,
      cmaToday: (cmaUsage as any)?.count ?? 0,
    };

    return NextResponse.json({
      ok: true,
      planType,
      limits,
      usage,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
