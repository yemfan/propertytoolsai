import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { addConversationMessage } from "@/lib/home-value/conversation";
import { pausePendingSequenceForLead } from "@/lib/home-value/pause-sequence";

async function sendAgentEmail(input: {
  to: string;
  subject: string;
  message: string;
}) {
  // Replace with provider
  console.log("SEND FOLLOWUP NOW", input);
  return { success: true };
}

export async function POST(req: Request) {
  try {
    const profile = await getCurrentProfile();

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (profile.role !== "agent" && profile.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const { followupId } = await req.json();

    if (!followupId) {
      return NextResponse.json(
        { success: false, error: "Missing followupId" },
        { status: 400 }
      );
    }

    const agentId = profile.agent_id ?? profile.id;

    let query = supabaseAdmin
      .from("lead_followups")
      .select("*")
      .eq("id", followupId)
      .eq("status", "pending");

    if (profile.role !== "admin") {
      query = query.eq("assigned_agent_id", agentId);
    }

    const { data: followup, error } = await query.single();

    if (error || !followup) {
      return NextResponse.json(
        { success: false, error: "Follow-up not found" },
        { status: 404 }
      );
    }

    if (followup.recipient_email) {
      await sendAgentEmail({
        to: followup.recipient_email,
        subject: followup.subject || "Follow-up",
        message: followup.message,
      });
    }

    await supabaseAdmin
      .from("lead_followups")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", followupId);

    await addConversationMessage({
      leadId: followup.lead_id,
      direction: "outbound",
      channel: followup.channel || "email",
      subject: followup.subject || null,
      message: followup.message,
      senderName: profile.full_name ?? "Agent",
      senderEmail: profile.email,
      recipientName: followup.recipient_name ?? null,
      recipientEmail: followup.recipient_email ?? null,
      status: "sent",
      relatedFollowupId: followup.id,
    });

    await pausePendingSequenceForLead(followup.lead_id);

    await supabaseAdmin
      .from("leads")
      .update({
        conversation_status: "agent_active",
        last_contact_at: new Date().toISOString(),
      })
      .eq("id", followup.lead_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("send followup now error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send follow-up" },
      { status: 500 }
    );
  }
}
