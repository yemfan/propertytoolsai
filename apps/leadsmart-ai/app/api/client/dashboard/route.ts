import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { assertLeadAccessForUser } from "@/lib/clientPortalContext";
import { buildClientRecommendations } from "@/lib/clientRecommendations";
import { buildPipelineState } from "@/lib/clientPortalPipeline";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const leadId = url.searchParams.get("leadId");
  if (!leadId) {
    return NextResponse.json({ ok: false, message: "leadId required" }, { status: 400 });
  }

  const lead = await assertLeadAccessForUser(user, leadId);
  if (!lead) {
    return NextResponse.json({ ok: false, message: "Lead not found for this account" }, { status: 404 });
  }

  const pipeline = buildPipelineState(lead.lead_status);
  const recommendations = buildClientRecommendations(lead);

  const nextSteps: string[] = [];
  if (pipeline.activeIndex < pipeline.stages.length - 1) {
    nextSteps.push(`Progress toward: ${pipeline.stages[pipeline.activeIndex + 1].label}`);
  }
  if (lead.next_contact_at) {
    nextSteps.push(`Next touchpoint scheduled (CRM): ${new Date(lead.next_contact_at).toLocaleString()}`);
  } else {
    nextSteps.push("Message your agent in Chat to schedule a check-in.");
  }

  return NextResponse.json({
    ok: true,
    deal: {
      id: String(lead.id),
      status: lead.lead_status,
      headline: lead.property_address?.trim() || lead.search_location || "Your home search",
      agentNote: lead.ai_intent ? `Intent: ${lead.ai_intent}` : null,
      aiScore: lead.ai_lead_score,
      aiConfidence: lead.ai_confidence,
      timelineHint: lead.ai_timeline,
    },
    pipeline,
    nextSteps,
    recommendations,
  });
}
