import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { chooseGreetingChannel, canSendGreeting } from "@/lib/greetings/compliance";
import type { GreetingEvent, GreetingEventType } from "@/lib/greetings/types";
import {
  fetchGreetingLeadById,
  generateGreeting,
  getGreetingSettings,
  recordGreetingHistory,
  sendGreeting,
} from "@/lib/greetings/service";

export const runtime = "nodejs";

const EVENT_TYPES: GreetingEventType[] = ["birthday", "holiday", "home_anniversary", "checkin"];

async function agentIdForUser(userId: string) {
  const { data } = await supabaseAdmin.from("agents").select("id").eq("auth_user_id", userId).maybeSingle();
  return data?.id != null ? String(data.id) : null;
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserWithRole(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const role = String(user.role ?? "").toLowerCase();
    const isAdmin = role === "admin";
    if (!isAdmin && !user.hasAgentRow) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { leadId?: string; eventType?: string };
    const leadId = String(body.leadId ?? "").trim();
    const eventType = String(body.eventType ?? "").trim() as GreetingEventType;
    if (!leadId || !eventType) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }
    if (!EVENT_TYPES.includes(eventType)) {
      return NextResponse.json({ success: false, error: "Invalid eventType" }, { status: 400 });
    }

    const lead = await fetchGreetingLeadById(leadId);
    if (!lead) {
      return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });
    }

    const myAgentId = await agentIdForUser(user.id);
    if (!isAdmin) {
      if (!myAgentId || String(lead.assignedAgentId) !== myAgentId) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
    }

    const settingsAgentId = lead.assignedAgentId || myAgentId || "";
    if (!settingsAgentId) {
      return NextResponse.json({ success: false, error: "Lead has no assigned agent" }, { status: 400 });
    }

    const settings = await getGreetingSettings(settingsAgentId);
    const channel = chooseGreetingChannel(lead, settings.preferredChannel);
    const compliance = canSendGreeting(lead, channel);
    if (!compliance.allowed) {
      return NextResponse.json(
        { success: false, error: compliance.reason || "Blocked by compliance" },
        { status: 400 }
      );
    }

    const event: GreetingEvent = {
      type: eventType,
      scheduledDate: new Date().toISOString(),
      ...(eventType === "holiday" ? { holidayKey: "manual_send" } : {}),
    };

    const generated = await generateGreeting({ lead, event, settings, channel });
    await sendGreeting({ lead, generated });
    await recordGreetingHistory({
      leadId: lead.id,
      agentId: lead.assignedAgentId ?? null,
      eventType: event.type,
      holidayKey: event.holidayKey ?? null,
      channel,
      subject: generated.subject || null,
      body: generated.body,
      status: "sent",
      sentAt: new Date().toISOString(),
      metadata: { manual: true, tags: generated.tags },
    });

    return NextResponse.json({ success: true, generated });
  } catch (e) {
    console.error("greetings send-now error:", e);
    const msg = e instanceof Error ? e.message : "Failed to send greeting";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
