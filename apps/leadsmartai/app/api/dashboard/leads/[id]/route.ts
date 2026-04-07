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
import { supabaseServer } from "@/lib/supabaseServer";

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
      last_contacted_at?: string;
      name?: string;
      email?: string;
      phone?: string;
      property_address?: string;
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

    // Direct field updates (name, email, phone, address, last_contacted_at).
    const directPatch: Record<string, unknown> = {};
    if (typeof body.name === "string") directPatch.name = body.name;
    if (typeof body.email === "string") directPatch.email = body.email;
    if (typeof body.phone === "string") directPatch.phone = body.phone;
    if (typeof body.property_address === "string") directPatch.property_address = body.property_address;
    if (body.last_contacted_at) directPatch.last_contacted_at = body.last_contacted_at;
    if (Object.keys(directPatch).length > 0) {
      await supabaseServer.from("leads").update(directPatch).eq("id", id);
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

