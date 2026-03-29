import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateAgentReplySuggestions } from "@/lib/ai-reply/service";
import type { BuyerContext, LeadReplyContext, LeadSourceType } from "@/lib/ai-reply/types";

function mapLeadSource(raw: string | null | undefined): LeadSourceType {
  const s = String(raw || "");
  if (s === "listing_inquiry") return "listing_inquiry";
  if (s === "affordability_report" || s === "affordability_lender_match") {
    return "affordability_report";
  }
  if (s === "home_value_estimate") return "home_value_estimate";
  return "unknown";
}

function parseListingIdFromNotes(notes: string): string | undefined {
  const m = notes.match(/listing\s+([^\s|]+)/i);
  return m?.[1]?.trim() || undefined;
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
      return NextResponse.json(
        { success: false, error: "Missing leadId" },
        { status: 400 }
      );
    }

    const agentId = profile.agent_id ?? profile.id;

    let leadQuery = supabaseAdmin.from("leads").select("*").eq("id", leadId);
    if (profile.role !== "admin") {
      leadQuery = leadQuery.eq("assigned_agent_id", agentId);
    }

    const { data: lead, error: leadError } = await leadQuery.single();
    if (leadError || !lead) {
      return NextResponse.json(
        { success: false, error: "Lead not found" },
        { status: 404 }
      );
    }

    const { data: conversations } = await supabaseAdmin
      .from("lead_conversations")
      .select("direction, subject, message, created_at, sender_name")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true });

    const latestInbound = [...(conversations ?? [])]
      .reverse()
      .find((msg) => msg.direction === "inbound");

    const notes = String(lead.notes || "");
    const listingMeta = {
      listingId: parseListingIdFromNotes(notes),
      listingAddress: (lead.address as string | null) || null,
      price: typeof lead.price === "number" ? lead.price : null,
      requestedTime: notes.includes("requested time:")
        ? notes.split("requested time:")[1]?.split("|")[0]?.trim() || null
        : null,
      city: (lead.city as string | null) || null,
      zip: (lead.zip as string | null) || null,
    };

    const leadSource = mapLeadSource(lead.source as string | null | undefined);

    let buyer: BuyerContext | null = null;
    if (
      (leadSource === "affordability_report" || lead.intent === "lender_match") &&
      lead.source_session_id
    ) {
      const { data: sess } = await supabaseAdmin
        .from("affordability_sessions")
        .select("max_home_price, input_json, buyer_intent_json")
        .eq("session_id", lead.source_session_id)
        .maybeSingle();

      if (sess) {
        const input = sess.input_json as { zip?: string; firstTimeBuyer?: boolean } | null;
        const intent = sess.buyer_intent_json as {
          preferredCity?: string;
          preferredZip?: string;
          timeline?: string;
          firstTimeBuyer?: boolean;
          alreadyPreapproved?: boolean;
          veteran?: boolean;
        } | null;
        const maxHp = sess.max_home_price;
        buyer = {
          maxHomePrice: typeof maxHp === "number" ? maxHp : undefined,
          preferredCity: intent?.preferredCity ?? (lead.city as string | null) ?? undefined,
          preferredZip: intent?.preferredZip ?? input?.zip ?? (lead.zip as string | null) ?? undefined,
          timeline: intent?.timeline,
          alreadyPreapproved: intent?.alreadyPreapproved,
          firstTimeBuyer: intent?.firstTimeBuyer ?? input?.firstTimeBuyer,
          veteran: intent?.veteran,
        };
      }
    }

    const context: LeadReplyContext = {
      leadId: lead.id,
      leadName: lead.name,
      leadEmail: lead.email,
      leadPhone: lead.phone,
      leadSource,
      intent: lead.intent,
      notes: lead.notes,
      engagementScore: lead.engagement_score,
      listing:
        leadSource === "listing_inquiry"
          ? {
              listingId: listingMeta.listingId,
              listingAddress: listingMeta.listingAddress || undefined,
              price: typeof listingMeta.price === "number" ? listingMeta.price : undefined,
              requestedTime: listingMeta.requestedTime,
              city: listingMeta.city || undefined,
              zip: listingMeta.zip || undefined,
            }
          : null,
      buyer: buyer && Object.values(buyer).some((v) => v !== undefined) ? buyer : null,
      conversation: (conversations ?? []).map((msg) => ({
        direction: msg.direction as "inbound" | "outbound" | "internal",
        subject: msg.subject,
        message: msg.message,
        created_at: msg.created_at,
        sender_name: msg.sender_name,
      })),
      latestInboundMessage: latestInbound?.message || null,
      agentName: profile.full_name || null,
      agentPlaybookSummary: process.env.AGENT_REPLY_PLAYBOOK?.trim() || null,
    };

    const result = await generateAgentReplySuggestions(context);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("ai reply route error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
