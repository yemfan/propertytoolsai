import { NextResponse } from "next/server";
import { requireRoleRoute } from "@/lib/auth/requireRole";
import { notifyAgentOfHotLead } from "@/lib/ai-sms/notifications";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const gate = await requireRoleRoute(["admin"], { strictUnauthorized: true });
  if (gate.ok === false) return gate.response;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      leadId?: string;
      reason?: string;
      latestMessage?: string;
    };
    const leadId = String(body.leadId ?? "").trim();
    const reason = String(body.reason ?? "").trim();
    const latestMessage = String(body.latestMessage ?? "").trim();
    if (!leadId || !reason || !latestMessage) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const result = await notifyAgentOfHotLead({ leadId, reason, latestMessage });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("hot-lead notify error:", error);
    return NextResponse.json({ success: false, error: "Failed to notify agent" }, { status: 500 });
  }
}
