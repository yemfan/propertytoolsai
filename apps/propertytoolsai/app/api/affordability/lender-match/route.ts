import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { determineBuyerRouting } from "@/lib/affordability/routing";
import { scheduleLeadScoreRefresh } from "@/lib/lead-scoring/service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      sessionId,
      name,
      email,
      phone,
      preferredCity,
      preferredZip,
      preferredPropertyType,
      timeline,
      firstTimeBuyer,
      alreadyPreapproved,
      veteran,
    } = body;

    if (!sessionId || !name || !email) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("affordability_sessions")
      .select("*")
      .eq("session_id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, error: "Affordability session not found" },
        { status: 404 }
      );
    }

    const routing = determineBuyerRouting({
      preferredCity,
      preferredZip,
      preferredPropertyType,
      timeline,
      firstTimeBuyer,
      alreadyPreapproved,
      veteran,
      maxHomePrice: Number(session.max_home_price || 0),
    });

    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .insert({
        name,
        email,
        phone: phone || null,
        city: preferredCity || null,
        zip: preferredZip || null,
        source: "affordability_lender_match",
        source_detail: "propertytoolsai",
        lead_type: "buyer",
        intent: "lender_match",
        status: "new",
        engagement_score: routing.intentScore,
        source_session_id: sessionId,
        conversation_status: "automated",
        notes: `Affordability lender match request. Route: ${routing.routeType}. Max home price: ${session.max_home_price}`,
      })
      .select()
      .single();

    if (leadError) throw leadError;

    const { error: activityError } = await supabaseAdmin.from("lead_activity_events").insert({
      lead_id: lead.id,
      event_type: "lead_created",
      title: "Buyer affordability lead created",
      description: `Lender match request from affordability tool. Route: ${routing.routeType}`,
      source: "affordability_report",
      actor_type: "customer",
      actor_name: name,
      metadata: {
        sessionId,
        preferredCity,
        preferredZip,
        preferredPropertyType,
        timeline,
        firstTimeBuyer,
        alreadyPreapproved,
        veteran,
        routeType: routing.routeType,
        intentScore: routing.intentScore,
        maxHomePrice: session.max_home_price,
      },
    });

    if (activityError) throw activityError;

    scheduleLeadScoreRefresh(String(lead.id));

    const { error: updateError } = await supabaseAdmin
      .from("affordability_sessions")
      .update({
        buyer_intent_json: {
          preferredCity,
          preferredZip,
          preferredPropertyType,
          timeline,
          firstTimeBuyer,
          alreadyPreapproved,
          veteran,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      routing,
    });
  } catch (error) {
    console.error("affordability lender match error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit lender match" },
      { status: 500 }
    );
  }
}
