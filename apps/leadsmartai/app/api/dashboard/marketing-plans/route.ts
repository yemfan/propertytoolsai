import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generatePlan } from "@/lib/marketing/planGenerator";
import { PLAN_TEMPLATES } from "@/lib/marketing/templates";
import type { TemplateKey } from "@/lib/marketing/types";

export async function GET(req: Request) {
  try {
    const supabase = supabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { data: agent } = await supabase.from("agents").select("id").eq("auth_user_id", userData.user.id).maybeSingle();
    if (!agent?.id) return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 403 });

    const agentId = String(agent.id);

    // Fetch plans + leads in parallel.
    const [plansRes, leadsRes] = await Promise.all([
      supabaseAdmin
        .from("marketing_plans")
        .select("*")
        .eq("agent_id", agentId as unknown as number)
        .order("updated_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("contacts")
        .select("id, name, email")
        .eq("agent_id", agentId as unknown as number)
        .order("name", { ascending: true })
        .limit(500),
    ]);

    if (plansRes.error) throw plansRes.error;

    // Build lead name lookup.
    const leadList = (leadsRes.data ?? []).map((l: any) => ({
      id: String(l.id),
      name: l.name || l.email || `Lead #${l.id}`,
    }));
    const leadMap = new Map(leadList.map((l: { id: string; name: string }) => [l.id, l.name]));

    // Enrich plans with lead names.
    const plans = (plansRes.data ?? []).map((p: any) => ({
      ...p,
      lead_name: p.contact_id ? leadMap.get(String(p.contact_id)) ?? null : null,
    }));

    return NextResponse.json({
      ok: true,
      plans,
      leads: leadList,
      templates: PLAN_TEMPLATES.map((t) => ({ key: t.key, title: t.title, description: t.description })),
    });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = supabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { data: agent } = await supabase.from("agents").select("id").eq("auth_user_id", userData.user.id).maybeSingle();
    if (!agent?.id) return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as { leadId?: string; templateKey?: string };
    if (!body.leadId || !body.templateKey) {
      return NextResponse.json({ ok: false, error: "leadId and templateKey are required" }, { status: 400 });
    }

    const plan = await generatePlan({
      agentId: String(agent.id),
      leadId: body.leadId,
      templateKey: body.templateKey as TemplateKey,
    });

    return NextResponse.json({ ok: true, plan });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
