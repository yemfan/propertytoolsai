import { NextResponse } from "next/server";
import type {
  ContactFrequency,
  ContactMethod,
  LeadRating,
  LeadStatus,
} from "@leadsmart/shared";
import {
  updateLeadNotes,
  updateLeadStatus,
  updateLeadFollowUpSettings,
  getCurrentAgentContext,
} from "@/lib/dashboardService";
import { updateLeadPipelineStage } from "@/lib/crm/pipeline/leadStage";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      lead_status?: LeadStatus;
      notes?: string;
      rating?: LeadRating;
      contact_frequency?: ContactFrequency;
      contact_method?: ContactMethod;
      pipeline_stage_id?: string | null;
    };

    if (body.lead_status) {
      await updateLeadStatus(id, body.lead_status);
    }
    if (typeof body.notes === "string") {
      await updateLeadNotes(id, body.notes);
    }
    if (body.rating || body.contact_frequency || body.contact_method) {
      await updateLeadFollowUpSettings(id, {
        rating: body.rating,
        contact_frequency: body.contact_frequency,
        contact_method: body.contact_method,
      });
    }
    if ("pipeline_stage_id" in body) {
      const { agentId } = await getCurrentAgentContext();
      await updateLeadPipelineStage({
        agentId,
        leadId: id,
        pipelineStageId:
          body.pipeline_stage_id === "" ? null : (body.pipeline_stage_id ?? null),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("dashboard lead update error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

