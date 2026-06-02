import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadReceptionistContext } from "@/lib/voice-agent/context";
import { placeOutboundCall } from "@/lib/voice-agent/outbound";
import { normalizePhoneE164 } from "@repo/voice";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_REMINDERS = 25;
const WINDOW_HOURS = 48;

type ApptRow = {
  id: string;
  caller_name: string | null;
  caller_phone: string | null;
  start_at: string;
  title: string | null;
};

/** Booked appointments starting within the next WINDOW_HOURS. */
async function upcoming(agentId: string): Promise<ApptRow[]> {
  const now = new Date();
  const until = new Date(now.getTime() + WINDOW_HOURS * 3600_000);
  const { data } = await supabaseAdmin
    .from("voice_appointments")
    .select("id,caller_name,caller_phone,start_at,title")
    .eq("agent_id", agentId as never)
    .eq("status", "booked")
    .gte("start_at", now.toISOString())
    .lt("start_at", until.toISOString())
    .order("start_at", { ascending: true })
    .limit(100);
  return (data ?? []) as unknown as ApptRow[];
}

function fmtWhen(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** List upcoming appointments (next 48h) for the reminder UI. */
export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const appts = await upcoming(agentId);
    return NextResponse.json({
      ok: true,
      appointments: appts.map((a) => ({
        id: a.id,
        name: a.caller_name,
        phone: a.caller_phone,
        startAt: a.start_at,
        title: a.title,
        callable: normalizePhoneE164(String(a.caller_phone ?? "")).ok,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load appointments.";
    return NextResponse.json({ ok: false, error: msg, appointments: [] }, { status: 500 });
  }
}

/** Place AI reminder calls for upcoming appointments (all, or the given ids). */
export async function POST(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
    const idSet = Array.isArray(body.ids) ? new Set(body.ids.map((x) => String(x))) : null;

    const ctx = await loadReceptionistContext(agentId);
    if (!ctx) {
      return NextResponse.json(
        { ok: false, error: "Your AI receptionist is turned off — enable it in Settings → Voice." },
        { status: 400 },
      );
    }

    let appts = await upcoming(agentId);
    if (idSet) appts = appts.filter((a) => idSet.has(String(a.id)));
    appts = appts.slice(0, MAX_REMINDERS);

    const results: Array<{ id: string; name: string | null; ok: boolean; error?: string }> = [];
    for (const a of appts) {
      const norm = normalizePhoneE164(String(a.caller_phone ?? ""));
      if (!norm.ok) {
        results.push({ id: a.id, name: a.caller_name, ok: false, error: "No phone number." });
        continue;
      }
      try {
        await placeOutboundCall({
          ctx,
          agentId,
          leadName: (a.caller_name ?? "").trim(),
          toNumberE164: norm.value,
          purpose: "appointment_reminder",
          detail: fmtWhen(a.start_at, ctx.timezone),
        });
        results.push({ id: a.id, name: a.caller_name, ok: true });
      } catch (e) {
        results.push({ id: a.id, name: a.caller_name, ok: false, error: e instanceof Error ? e.message : "Call failed." });
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    const placed = results.filter((r) => r.ok).length;
    return NextResponse.json({ ok: true, placed, failed: results.length - placed, total: results.length, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Reminders failed.";
    console.error("voice/appointment-reminders", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
