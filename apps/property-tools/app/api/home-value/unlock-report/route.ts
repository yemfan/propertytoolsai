import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateHomeValueReportPdf } from "@/lib/home-value/report-pdf";
import { createLeadFromHomeValue } from "@/lib/home-value/lead";
import { sendHomeValueReportEmail } from "@/lib/home-value/email";
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

    const assignment = await autoAssignLeadToAgent({
      leadId: lead.id,
      zip: session.zip,
      city: session.city,
    });

    if (assignment?.agentId) {
      await createAgentNotification({
        agentId: assignment.agentId,
        leadId: lead.id,
        type: "new_home_value_lead",
        title: "New Home Value Lead Assigned",
        message: `${name} unlocked a home value report for ${session.property_address}.`,
        actionUrl: `/agent/leads/${lead.id}`,
        metadata: {
          source: "home_value_estimate",
          property_address: session.property_address,
          estimate_value: session.estimate_value,
        },
      });
    }

    await queueHomeValueSequence({
      leadId: lead.id,
      customerName: name,
      customerEmail: email,
      customerPhone: phone ?? null,
      propertyAddress: session.property_address,
      estimateValue: session.estimate_value,
      assignedAgentName: assignment?.fullName ?? null,
      assignedAgentId: assignment?.agentId ?? null,
    });

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

    const pdfUrl = `/reports/home-value/${pdf.filename}`;

    await supabaseAdmin.from("home_value_reports").upsert({
      session_id: sessionId,
      lead_id: lead.id,
      property_address: session.property_address,
      estimate_value: session.estimate_value,
      range_low: session.range_low,
      range_high: session.range_high,
      confidence: session.confidence,
      report_json: session,
      pdf_url: pdfUrl,
      emailed_at: new Date().toISOString(),
    });

    await sendHomeValueReportEmail({
      to: email,
      name,
      address: session.property_address,
      reportUrl: pdfUrl,
    });

    return NextResponse.json({
      success: true,
      leadId: lead.id,
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
      { success: false, error: "Failed to unlock report" },
      { status: 500 }
    );
  }
}
