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
  // Replace with real email provider
  console.log("MANUAL EMAIL SEND", input);
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

    const { leadId, subject, message } = await req.json();

    if (!leadId || !message) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const agentId = profile.agent_id ?? profile.id;

    let leadQuery = supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", leadId);

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

    if (lead.email) {
      await sendAgentEmail({
        to: lead.email,
        subject: subject || `Regarding ${lead.address || "your property"}`,
        message,
      });
    }

    await addConversationMessage({
      leadId,
      direction: "outbound",
      channel: "email",
      subject: subject || null,
      message,
      senderName: profile.full_name ?? "Agent",
      senderEmail: profile.email,
      recipientName: lead.name ?? null,
      recipientEmail: lead.email ?? null,
      status: "sent",
    });

    await pausePendingSequenceForLead(leadId);

    await supabaseAdmin
      .from("leads")
      .update({
        conversation_status: "agent_active",
        last_contact_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("send manual message error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send message" },
      { status: 500 }
    );
  }
}
