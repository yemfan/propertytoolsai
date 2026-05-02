import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createLeadFromHomeValue } from "@/lib/home-value/lead";
import { pickAgentForHomeValueLead } from "@/lib/home-value/assignment";
import { queueHomeValueSequence } from "@/lib/home-value/followup-sequence";
import { createAgentNotification } from "@/lib/home-value/agent-notification";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, name, email, phone } = body;

    if (!sessionId || !name || !email) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Try to load session from DB; fall back to client-provided data
    let session: Record<string, any> | null = null;
    const { data: dbSession } = await supabaseAdmin
      .from("home_value_sessions")
      .select("*")
      .eq("session_id", sessionId)
      .single();

    if (dbSession) {
      session = dbSession;
    } else {
      // Use data sent by client (estimate values already in browser state)
      session = {
        property_address: body.property_address || "",
        full_address: body.property_address || "",
        city: body.city || null,
        zip: body.zip || null,
        estimate_value: body.estimate_value || 0,
        range_low: body.range_low || 0,
        range_high: body.range_high || 0,
        confidence: body.confidence || "low",
        confidence_score: body.confidence_score || 0,
        median_ppsf: body.median_ppsf || 0,
        local_trend_pct: null,
        comp_count: null,
        recommendations: body.recommendations || { actions: [] },
      };
    }

    const propertyAddress = session.property_address || session.full_address || body.property_address || "";

    // --- Pick the owning agent up front: contacts.agent_id is NOT NULL,
    //     so we need an agent before the insert. Falls back to the first
    //     accepting agent when zip/city don't match anyone's service area.
    const picked = await pickAgentForHomeValueLead({
      zip: session.zip,
      city: session.city,
    });
    if (!picked) {
      console.error("unlock-report: no eligible agent (accepts_new_leads=true)");
      return NextResponse.json(
        {
          success: false,
          error:
            "We couldn't route this report — no agents are currently accepting new leads. Please try again later.",
        },
        { status: 503 },
      );
    }

    // --- Core: create contact row (owns lead) ---
    const lead = await createLeadFromHomeValue({
      name,
      email,
      phone,
      address: propertyAddress,
      estimateValue: session.estimate_value,
      confidence: session.confidence,
      sessionId,
      zip: session.zip,
      city: session.city,
      agentId: picked.id,
    });

    // The picked agent is the assignment — wrap into the same shape the
    // downstream notification + followup paths expect. Using authUserId
    // (uuid) for agent_notifications.agent_id matches the column type
    // and the legacy autoAssignLeadToAgent's behavior.
    const assignment: { agentId: string; fullName: string | null; email: string | null } | null =
      picked.authUserId != null
        ? {
            agentId: picked.authUserId,
            fullName: picked.fullName,
            email: picked.email,
          }
        : null;

    // Agent notification (fire-and-forget)
    if (assignment?.agentId) {
      createAgentNotification({
        agentId: assignment.agentId,
        leadId: String(lead.id),
        type: "new_home_value_lead",
        title: "New Home Value Lead Assigned",
        message: `${name} unlocked a home value report for ${propertyAddress}.`,
        actionUrl: `/agent/leads/${lead.id}`,
        metadata: {
          source: "home_value_estimate",
          property_address: propertyAddress,
          estimate_value: session.estimate_value,
        },
      }).catch((e) => console.error("Agent notification failed:", e));
    }

    // Followup sequence (fire-and-forget)
    queueHomeValueSequence({
      leadId: String(lead.id),
      customerName: name,
      customerEmail: email,
      customerPhone: phone ?? null,
      propertyAddress,
      estimateValue: session.estimate_value,
      assignedAgentName: assignment?.fullName ?? null,
      assignedAgentId: assignment?.agentId ?? null,
    }).catch((e) => console.error("Followup queue failed:", e));

    // Persist report row (best-effort)
    supabaseAdmin
      .from("home_value_reports")
      .upsert({
        session_id: sessionId,
        lead_id: String(lead.id),
        property_address: propertyAddress,
        estimate_value: session.estimate_value,
        range_low: session.range_low,
        range_high: session.range_high,
        confidence: session.confidence,
        report_json: session,
        pdf_url: null,
        emailed_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.error("Report upsert failed:", error);
      });

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      assignedAgent: assignment ?? null,
      report: {
        estimate: {
          value: session.estimate_value,
          rangeLow: session.range_low ?? session.estimate_low,
          rangeHigh: session.range_high ?? session.estimate_high,
          confidence: session.confidence,
          confidenceScore: session.confidence_score,
        },
        market: {
          medianPpsf: session.median_ppsf,
          localTrendPct: session.local_trend_pct,
          compCount: session.comp_count,
          city: session.city,
        },
        recommendations: session.recommendations ?? {
          actions: [],
        },
        pdfUrl: null,
      },
    });
  } catch (error) {
    console.error("unlock-report error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to unlock report. Please try again." },
      { status: 500 }
    );
  }
}
