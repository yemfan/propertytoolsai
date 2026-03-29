import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { recordLeadEvent, scoreLead } from "@/lib/leadScoring";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }
    const body = (await req.json().catch(() => ({}))) as {
      lead_id?: string | number;
      event_type?: string;
      metadata?: Record<string, any>;
    };
    const leadId = String(body.lead_id ?? "").trim();
    const eventType = String(body.event_type ?? "").trim().toLowerCase();
    if (!leadId || !eventType) {
      return NextResponse.json(
        { ok: false, error: "lead_id and event_type are required" },
        { status: 400 }
      );
    }

    await recordLeadEvent({
      lead_id: leadId as any,
      event_type: eventType,
      metadata: body.metadata ?? {},
    });
    const score = await scoreLead(leadId, true);
    return NextResponse.json({ ok: true, score });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
