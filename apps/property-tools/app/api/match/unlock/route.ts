import { NextResponse } from "next/server";
import { runSmartMatchUnlockAutomation } from "@/lib/match/smartMatchAutomation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { scheduleLeadScoreRefresh } from "@/lib/lead-scoring/service";
import type { BuyerPreferences, PropertyMatch } from "@/lib/match/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      email,
      phone,
      preferences,
      topMatch,
      sessionId,
    } = body as {
      name?: string;
      email?: string;
      phone?: string;
      preferences?: BuyerPreferences & Record<string, unknown>;
      topMatch?: PropertyMatch | null;
      sessionId?: string | null;
    };

    if (!name || !email || !preferences || typeof preferences !== "object") {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const budget = Number((preferences as BuyerPreferences).budget);
    if (!Number.isFinite(budget) || budget <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid preferences: budget required" },
        { status: 400 }
      );
    }

    const { data: lead, error } = await supabaseAdmin
      .from("leads")
      .insert({
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        phone: phone ? String(phone).trim() : null,
        city: preferences.city ? String(preferences.city) : null,
        state: preferences.state ? String(preferences.state) : null,
        source: "smart_property_match",
        source_detail: "propertytoolsai",
        lead_type: "buyer",
        intent: "smart_match",
        status: "new",
        engagement_score: typeof topMatch?.matchScore === "number" ? Math.min(100, topMatch.matchScore) : 78,
        conversation_status: "automated",
        source_session_id: sessionId || null,
        notes: `Smart Match unlocked. Budget: ${budget}. Top match: ${topMatch?.address || "n/a"}`,
      })
      .select()
      .single();

    if (error) throw error;

    const leadId = String(lead.id);

    await supabaseAdmin.from("lead_activity_events").insert({
      lead_id: leadId,
      event_type: "lead_created",
      title: "Smart Match lead created",
      description: `Lead unlocked full smart matches${topMatch?.address ? ` for ${topMatch.address}` : ""}.`,
      source: "smart_property_match",
      actor_type: "customer",
      actor_name: String(name).trim(),
      metadata: {
        preferences,
        topMatch,
        sessionId: sessionId || null,
      },
    });

    scheduleLeadScoreRefresh(leadId);

    try {
      await runSmartMatchUnlockAutomation({
        leadId,
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        phone: phone ? String(phone).trim() : null,
        preferences: preferences as BuyerPreferences,
        topMatch: topMatch ?? null,
      });
    } catch (autoErr) {
      console.warn("smart match unlock automation:", autoErr);
    }

    return NextResponse.json({
      success: true,
      leadId,
    });
  } catch (error) {
    console.error("smart match unlock error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to unlock full matches" },
      { status: 500 }
    );
  }
}
