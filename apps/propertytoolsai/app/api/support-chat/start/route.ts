import { NextResponse } from "next/server";
import { notifyAssignedAgentChatSms } from "@/lib/notifyAssignedAgentChatSms";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { startConversationSchema } from "@/lib/support-chat/schema";
import {
  createConversation,
  type CreateConversationInput,
} from "@/lib/support-chat/service";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = startConversationSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      notifyAgentSms,
      customerUserId,
      assignedAgentAuthUserId,
      assignedAgentName,
      ...rest
    } = parsed.data;

    const conversation = await createConversation({
      ...(rest as CreateConversationInput),
      customerUserId: customerUserId ?? null,
      assignedAgentAuthUserId: assignedAgentAuthUserId ?? null,
      assignedAgentName: assignedAgentName ?? null,
    });

    const smsEnabled = process.env.AGENT_CHAT_SMS_NOTIFY === "true";
    if (smsEnabled && notifyAgentSms && assignedAgentAuthUserId) {
      const { data: agentProf } = await supabaseAdmin
        .from("user_profiles")
        .select("phone")
        .eq("user_id", assignedAgentAuthUserId)
        .maybeSingle();

      const rawPhone = agentProf?.phone != null ? String(agentProf.phone).trim() : "";
      const e164 = normalizeToE164(rawPhone);
      if (e164) {
        await notifyAssignedAgentChatSms({
          toPhoneE164: e164,
          agentDisplayName: assignedAgentName ?? "Agent",
          customerName: rest.customerName,
          conversationPublicId: conversation.publicId,
        });
      }
    }

    return NextResponse.json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "Failed to start conversation" },
      { status: 500 }
    );
  }
}

function normalizeToE164(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith("+")) return t;
  const d = t.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  if (d.length >= 10 && d.length <= 15) return `+${d}`;
  return null;
}
