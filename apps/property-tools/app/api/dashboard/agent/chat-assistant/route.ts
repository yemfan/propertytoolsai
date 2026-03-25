import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateChatAssistantResponse } from "@/lib/chat-assistant/service";
import type { ChatAssistantContext, ChatAssistantLeadSource } from "@/lib/chat-assistant/types";

export const runtime = "nodejs";

function mapLeadSource(raw: string | null | undefined): ChatAssistantLeadSource {
  const s = String(raw || "");
  if (s === "listing_inquiry") return "listing_inquiry";
  if (s === "home_value_estimate") return "home_value_estimate";
  if (s === "affordability_report" || s === "affordability_lender_match") return "affordability_report";
  if (s === "smart_property_match") return "smart_property_match";
  return "unknown";
}

function parseTourTimeFromNotes(notes: string): string | null {
  if (!notes.includes("requested time:")) return null;
  return notes.split("requested time:")[1]?.split("|")[0]?.trim() || null;
}

export async function POST(req: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || (profile.role !== "agent" && profile.role !== "admin")) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: profile ? 403 : 401 }
      );
    }

    const { leadId } = await req.json();
    if (!leadId) {
      return NextResponse.json({ success: false, error: "Missing leadId" }, { status: 400 });
    }

    const agentId = profile.agent_id ?? profile.id;
    let leadQuery = supabaseAdmin.from("leads").select("*").eq("id", leadId);
    if (profile.role !== "admin") {
      leadQuery = leadQuery.eq("assigned_agent_id", agentId);
    }

    const { data: lead, error: leadError } = await leadQuery.single();
    if (leadError || !lead) {
      return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });
    }

    const [{ data: conversationRows }, { data: hvReport }, { data: smartAct }] = await Promise.all([
      supabaseAdmin
        .from("lead_conversations")
        .select("direction, message, subject, created_at, sender_name")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("home_value_reports")
        .select("estimate_value")
        .eq("lead_id", leadId)
        .maybeSingle(),
      supabaseAdmin
        .from("lead_activity_events")
        .select("metadata")
        .eq("lead_id", leadId)
        .eq("source", "smart_property_match")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    let affordabilityBudget: number | null = null;
    const src = mapLeadSource(lead.source as string | null);
    if (
      lead.source_session_id &&
      (src === "affordability_report" || lead.intent === "lender_match")
    ) {
      const { data: sess } = await supabaseAdmin
        .from("affordability_sessions")
        .select("max_home_price")
        .eq("session_id", lead.source_session_id)
        .maybeSingle();
      const m = sess?.max_home_price;
      affordabilityBudget = typeof m === "number" ? m : null;
    }

    const notes = String(lead.notes || "");
    const meta = smartAct?.metadata as Record<string, unknown> | null | undefined;
    const smartMatchPreferences =
      meta && typeof meta.preferences === "object" && meta.preferences !== null
        ? (meta.preferences as Record<string, unknown>)
        : notes.toLowerCase().includes("smart match")
          ? { fromNotes: notes.slice(0, 800) }
          : null;

    const leadSource = mapLeadSource(lead.source as string | null);

    const context: ChatAssistantContext = {
      leadId: String(lead.id),
      leadName: lead.name,
      leadEmail: lead.email,
      leadPhone: lead.phone,
      leadSource,
      intent: lead.intent,
      city: lead.city,
      zip: lead.zip,
      notes: lead.notes,
      engagementScore: lead.engagement_score,
      smartMatchPreferences,
      listingAddress: lead.address || null,
      listingPrice: typeof lead.price === "number" ? lead.price : null,
      requestedTourTime: parseTourTimeFromNotes(notes),
      affordabilityBudget,
      homeValueEstimate:
        typeof hvReport?.estimate_value === "number" ? hvReport.estimate_value : null,
      conversation: (conversationRows ?? []).map((row) => ({
        direction: row.direction as "inbound" | "outbound" | "internal",
        message: row.message,
        subject: row.subject,
        createdAt: row.created_at,
        senderName: row.sender_name,
      })),
      agentName: profile.full_name || null,
    };

    const result = await generateChatAssistantResponse(context);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("chat assistant error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate chat assistant output" },
      { status: 500 }
    );
  }
}
