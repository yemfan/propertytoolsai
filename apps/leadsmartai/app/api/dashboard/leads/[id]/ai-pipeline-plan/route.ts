import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { listPipelineStages } from "@/lib/crm/pipeline/stages";
import { listTasksForAgent } from "@/lib/crm/pipeline/tasks";
import { generateAiPipelinePlan } from "@/lib/crm/pipeline/aiPlan";
import { applyAiPipelinePlan } from "@/lib/crm/pipeline/applyPlan";
import type { AiPipelinePlan } from "@/lib/crm/pipeline/types";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: leadId } = await ctx.params;
    const { agentId } = await getCurrentAgentContext();

    const body = (await req.json().catch(() => ({}))) as {
      apply?: boolean;
      context?: string | null;
      plan?: AiPipelinePlan;
    };

    const { data: lead, error } = await supabaseServer
      .from("leads")
      .select(
        "id,name,email,phone,property_address,search_location,price_min,price_max,lead_status,rating,notes,pipeline_stage_id,source,engagement_score,last_activity_at,created_at"
      )
      .eq("id", leadId as any)
      .eq("agent_id", agentId as any)
      .maybeSingle();

    if (error) throw error;
    if (!lead) {
      return NextResponse.json({ ok: false, error: "Lead not found." }, { status: 404 });
    }

    let plan: AiPipelinePlan;
    if (body.apply && body.plan) {
      plan = body.plan;
    } else {
      const [stages, openTasks] = await Promise.all([
        listPipelineStages(agentId),
        listTasksForAgent({ agentId, leadId, status: "open_only", limit: 50 }),
      ]);
      plan = await generateAiPipelinePlan({
        lead: lead as Record<string, unknown>,
        stages,
        openTasks,
        notesExtra: body.context ?? null,
      });
    }

    if (body.apply) {
      const result = await applyAiPipelinePlan({ agentId, leadId, plan });
      return NextResponse.json({ ok: true, plan, applied: true, ...result });
    }

    return NextResponse.json({ ok: true, plan, applied: false });
  } catch (e: any) {
    console.error("ai-pipeline-plan", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
