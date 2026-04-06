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
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let query = supabaseAdmin
      .from("marketing_plans")
      .select("*")
      .eq("agent_id", agentId as unknown as number)
      .order("created_at", { ascending: false })
      .limit(50);

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true, plans: data ?? [], templates: PLAN_TEMPLATES.map((t) => ({ key: t.key, title: t.title, description: t.description })) });
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
