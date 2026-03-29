import { NextResponse } from "next/server";
import { updateLeadPipelineStage } from "@/lib/crm/pipeline/leadStage";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { resolveMobileSlugToStageId } from "@/lib/mobile/mobilePipeline";

export const runtime = "nodejs";

type Body = {
  stage_slug?: string;
  pipeline_stage_id?: string | null;
};

/**
 * One-tap pipeline: send `{ "stage_slug": "qualified" }` or `{ "pipeline_stage_id": "<uuid>" }`.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await ctx.params;
    const leadId = String(id ?? "").trim();
    if (!leadId) {
      return NextResponse.json({ ok: false, success: false, error: "Missing lead id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    let pipelineStageId: string | null = null;

    if (body.pipeline_stage_id !== undefined) {
      pipelineStageId =
        body.pipeline_stage_id === "" || body.pipeline_stage_id == null
          ? null
          : String(body.pipeline_stage_id);
    } else if (body.stage_slug != null) {
      const slug = String(body.stage_slug).trim().toLowerCase();
      const resolved = await resolveMobileSlugToStageId(auth.ctx.agentId, slug);
      if (!resolved) {
        return NextResponse.json(
          { ok: false, success: false, error: "Invalid stage_slug" },
          { status: 400 }
        );
      }
      pipelineStageId = resolved;
    } else {
      return NextResponse.json(
        { ok: false, success: false, error: "stage_slug or pipeline_stage_id is required" },
        { status: 400 }
      );
    }

    await updateLeadPipelineStage({
      agentId: auth.ctx.agentId,
      leadId,
      pipelineStageId,
    });

    return NextResponse.json({ ok: true, success: true, pipeline_stage_id: pipelineStageId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (msg.includes("not found") || msg.includes("Lead not found")) {
      return NextResponse.json({ ok: false, success: false, error: "Lead not found" }, { status: 404 });
    }
    if (msg.includes("Invalid pipeline")) {
      return NextResponse.json({ ok: false, success: false, error: msg }, { status: 400 });
    }
    console.error("PATCH /api/mobile/leads/[id]/pipeline-stage", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}
