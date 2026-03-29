import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { assertLeadAccessForUser } from "@/lib/clientPortalContext";
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
    return NextResponse.json({ ok: false, message: "Lead not found" }, { status: 404 });
  }

  const pipeline = buildPipelineState(lead.lead_status);

  return NextResponse.json({
    ok: true,
    leadId: String(lead.id),
    leadStatus: lead.lead_status,
    ...pipeline,
  });
}
