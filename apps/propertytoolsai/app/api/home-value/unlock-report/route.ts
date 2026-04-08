import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createLeadFromHomeValue } from "@/lib/home-value/lead";
import { autoAssignLeadToAgent } from "@/lib/home-value/assignment";
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

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("home_value_sessions")
      .select("*")
      .eq("session_id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

    // --- Core: create lead (must succeed) ---
    const lead = await createLeadFromHomeValue({
      name,
      email,
      phone,
      address: session.property_address,
      estimateValue: session.estimate_value,
      confidence: session.confidence,
      sessionId,
      zip: session.zip,
      city: session.city,
    });

    // --- Best-effort: assignment, notification, followup, PDF, email ---
    let assignment: { agentId: string; fullName: string | null; email: string | null } | null = null;
    try {
      assignment = await autoAssignLeadToAgent({
        leadId: String(lead.id),
        zip: session.zip,
        city: session.city,
      });
    } catch (e) {
      console.error("Assignment failed (non-fatal):", e);
    }

    // Agent notification (fire-and-forget)
    if (assignment?.agentId) {
      createAgentNotification({
        agentId: assignment.agentId,
        leadId: String(lead.id),
        type: "new_home_value_lead",
        title: "New Home Value Lead Assigned",
        message: `${name} unlocked a home value report for ${session.property_address}.`,
        actionUrl: `/agent/leads/${lead.id}`,
        metadata: {
          source: "home_value_estimate",
          property_address: session.property_address,
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
      propertyAddress: session.property_address,
      estimateValue: session.estimate_value,
      assignedAgentName: assignment?.fullName ?? null,
      assignedAgentId: assignment?.agentId ?? null,
    }).catch((e) => console.error("Followup queue failed:", e));

    // PDF generation (best-effort, may not be available in all environments)
    let pdfUrl: string | null = null;
    try {
      const { generateHomeValueReportPdf } = await import("@/lib/home-value/report-pdf");
      const pdf = await generateHomeValueReportPdf({
        sessionId,
        address: session.property_address,
        estimateValue: session.estimate_value,
        rangeLow: session.range_low,
        rangeHigh: session.range_high,
        confidence: session.confidence,
        medianPpsf: session.median_ppsf,
        localTrendPct: session.local_trend_pct,
        compCount: session.comp_count,
        actions: session.recommendations?.actions ?? [],
      });
      pdfUrl = `/reports/home-value/${pdf.filename}`;
    } catch (e) {
      console.error("PDF generation failed (non-fatal):", e);
    }

    // Persist report row
    await supabaseAdmin
      .from("home_value_reports")
      .upsert({
        session_id: sessionId,
        lead_id: String(lead.id),
        property_address: session.property_address,
        estimate_value: session.estimate_value,
        range_low: session.range_low,
        range_high: session.range_high,
        confidence: session.confidence,
        report_json: session,
        pdf_url: pdfUrl,
        emailed_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.error("Report upsert failed:", error);
      });

    // Email (best-effort)
    if (pdfUrl) {
      import("@/lib/home-value/email")
        .then(({ sendHomeValueReportEmail }) =>
          sendHomeValueReportEmail({
            to: email,
            name,
            address: session.property_address,
            reportUrl: pdfUrl!,
          })
        )
        .catch((e) => console.error("Report email failed:", e));
    }

    return NextResponse.json({
      success: true,
      leadId: String(lead.id),
      assignedAgent: assignment ?? null,
      report: {
        estimate: {
          value: session.estimate_value,
          rangeLow: session.range_low,
          rangeHigh: session.range_high,
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
        pdfUrl,
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
