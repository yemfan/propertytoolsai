import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { insertToolEvent } from "@/lib/homeValue/funnelPersistence";
import { buildLeadRecordFromUnlockBody } from "@/lib/leads/leadRecord";
import { persistToolLead, type ToolLeadBody } from "@/lib/leads/persistToolLead";

export const runtime = "nodejs";

/**
 * POST /api/home-value/unlock-report
 * Same CRM shape as /api/leads/tool-capture, plus `report_unlocked` tool_event.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ToolLeadBody;
    const authUser = await getUserFromRequest(req);
    const userId = authUser?.id ?? null;

    const merged: ToolLeadBody = {
      ...body,
      source: body.source ?? "home_value_estimator",
      tool: body.tool ?? "home_value_estimator",
    };

    const sessionId = String(merged.session_id ?? "").trim();

    const result = await persistToolLead(merged, { userId });
    if (result.ok === false) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status ?? 500 }
      );
    }

    if (sessionId && result.leadId) {
      try {
        await insertToolEvent({
          sessionId,
          userId,
          toolName: "home_value",
          eventName: "report_unlocked",
          metadata: {
            lead_id: result.leadId,
            source: merged.source,
          },
        });
      } catch (e) {
        console.warn("unlock-report tool_events", e);
      }
    }

    const leadRecord =
      result.leadId != null
        ? buildLeadRecordFromUnlockBody({
            leadId: result.leadId,
            name: merged.name,
            email: merged.email,
            phone: merged.phone,
            fullAddress: merged.full_address ?? merged.property_address,
            city: merged.city ?? null,
            state: merged.state ?? null,
            zip: merged.zip ?? null,
            propertyValue: merged.property_value,
            estimateLow: merged.estimate_low,
            estimateHigh: merged.estimate_high,
            confidence: merged.confidence,
            confidenceScore: merged.confidence_score,
            likelyIntent: merged.likely_intent,
            engagementScore: merged.engagement_score,
            timeline: merged.timeline ?? merged.timeframe,
            buyingOrSelling: merged.buying_or_selling,
            status: "new",
            createdAt: new Date().toISOString(),
          })
        : undefined;

    return NextResponse.json({ ok: true, leadId: result.leadId, leadRecord });
  } catch (e: any) {
    console.error("POST /api/home-value/unlock-report", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
