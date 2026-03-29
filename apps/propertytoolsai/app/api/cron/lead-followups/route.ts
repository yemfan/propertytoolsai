import { NextResponse } from "next/server";
import { logLeadActivity } from "@/lib/activity/logLeadActivity";
import { addConversationMessage } from "@/lib/home-value/conversation";
import { supabaseAdmin } from "@/lib/supabase/admin";

type FollowupJob = {
  id: string;
  lead_id: string;
  channel: string;
  subject?: string | null;
  message: string;
  recipient_email?: string | null;
  recipient_phone?: string | null;
  recipient_name?: string | null;
  metadata?: Record<string, unknown> | null;
};

async function sendEmailFollowup(input: {
  to: string;
  subject: string;
  message: string;
}) {
  // Replace with your provider later
  console.log("EMAIL", input);
  return { success: true };
}

async function sendSmsFollowup(input: {
  to: string;
  message: string;
}) {
  // Replace with your SMS provider later
  console.log("SMS", input);
  return { success: true };
}

export async function POST() {
  try {
    const now = new Date().toISOString();

    const { data: jobs, error } = await supabaseAdmin
      .from("lead_followups")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", now)
      .order("scheduled_for", { ascending: true })
      .limit(50);

    if (error) throw error;

    const rows = (jobs ?? []) as FollowupJob[];

    for (const job of rows) {
      try {
        if (job.channel === "email" && job.recipient_email) {
          await sendEmailFollowup({
            to: job.recipient_email,
            subject: job.subject || "Follow-up",
            message: job.message,
          });
        } else if (job.channel === "sms" && job.recipient_phone) {
          await sendSmsFollowup({
            to: job.recipient_phone,
            message: job.message,
          });
        } else {
          throw new Error("Missing recipient for follow-up");
        }

        await supabaseAdmin
          .from("lead_followups")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        await addConversationMessage({
          leadId: job.lead_id,
          direction: "outbound",
          channel: job.channel === "sms" ? "sms" : "email",
          subject: job.subject || null,
          message: job.message,
          senderName: "Automated follow-up",
          senderEmail: null,
          recipientName: job.recipient_name ?? null,
          recipientEmail: job.recipient_email ?? null,
          status: "sent",
          relatedFollowupId: job.id,
        });

        const meta = job.metadata && typeof job.metadata === "object" ? job.metadata : {};
        await logLeadActivity({
          leadId: job.lead_id,
          eventType: "followup_sent",
          title: "Automated follow-up sent",
          description: job.subject || "Follow-up delivered",
          source: "followup_cron",
          actorType: "system",
          relatedFollowupId: job.id,
          metadata: {
            channel: job.channel,
            ...meta,
          },
        });
      } catch (jobError) {
        console.error("Follow-up send failed", job.id, jobError);

        await supabaseAdmin
          .from("lead_followups")
          .update({
            status: "failed",
          })
          .eq("id", job.id);
      }
    }

    return NextResponse.json({
      success: true,
      processed: rows.length,
    });
  } catch (error) {
    console.error("process-followups error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process follow-ups" },
      { status: 500 }
    );
  }
}
