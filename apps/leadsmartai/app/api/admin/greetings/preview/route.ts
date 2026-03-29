import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { chooseGreetingChannel } from "@/lib/greetings/compliance";
import { detectGreetingEvents } from "@/lib/greetings/events";
import { fetchGreetingLeadById, generateGreeting, getGreetingSettings } from "@/lib/greetings/service";

export const runtime = "nodejs";

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

    const body = (await req.json().catch(() => ({}))) as { leadId?: string };
    const leadId = String(body.leadId ?? "").trim();
    if (!leadId) {
      return NextResponse.json({ success: false, error: "Missing leadId" }, { status: 400 });
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
    const events = detectGreetingEvents(lead);
    const event =
      events[0] ?? ({ type: "birthday" as const, scheduledDate: new Date().toISOString() } as const);
    const channel = chooseGreetingChannel(lead, settings.preferredChannel);
    const generated = await generateGreeting({ lead, event, settings, channel });

    return NextResponse.json({ success: true, generated, event, channel });
  } catch (e) {
    console.error("greetings preview error:", e);
    return NextResponse.json({ success: false, error: "Failed to preview greeting" }, { status: 500 });
  }
}
