import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { generateInitialReply } from "@/lib/autoReply";
import { getOrCreateConversation } from "@/lib/leadConversationHelpers";
import type { ReplyMessage } from "@/lib/aiReplyGenerator";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: leadId } = await ctx.params;
    const { agentId } = await getCurrentAgentContext();

    const { data: lead, error } = await supabaseServer
      .from("contacts")
      .select(
        "id,name,email,phone,property_address,search_location,price_min,price_max,intent,rating,source,lead_status"
      )
      .eq("id", leadId)
      .eq("agent_id", agentId)
      .maybeSingle();

    if (error) throw error;
    if (!lead) {
      return NextResponse.json({ ok: false, error: "Lead not found." }, { status: 404 });
    }

    const conv = await getOrCreateConversation(leadId, agentId);
    const messages = (Array.isArray((conv as any).messages)
      ? (conv as any).messages
      : []) as ReplyMessage[];

    const text = await generateInitialReply(lead as any, {
      messages,
      preferences: ((conv as any).preferences as Record<string, unknown>) ?? {},
    });

    return NextResponse.json({ ok: true, suggestion: text });
  } catch (e: any) {
    console.error("ai-suggest", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
