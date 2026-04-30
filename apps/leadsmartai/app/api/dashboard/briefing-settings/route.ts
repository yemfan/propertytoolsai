import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/briefing-settings
 * PATCH /api/dashboard/briefing-settings
 *
 * Per-agent schedule for the morning + evening briefings shipped in
 * #238. Each agent picks their own clock time (HH:MM) and IANA
 * timezone; the cron is a single tick that branches off these
 * preferences. Defaults match the migration: 07:00 / 18:00 /
 * America/Los_Angeles.
 */

const HHMM_RE = /^[0-2][0-9]:[0-5][0-9]$/;

type SettingsRow = {
  briefing_morning_time: string;
  briefing_evening_time: string;
  briefing_timezone: string;
};

export async function GET() {
  let ctx;
  try {
    ctx = await getCurrentAgentContext();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("agents")
    .select("briefing_morning_time, briefing_evening_time, briefing_timezone")
    .eq("id", ctx.agentId)
    .maybeSingle();
  if (error) {
    console.error("[briefing-settings] get", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  const row = (data as SettingsRow | null) ?? {
    briefing_morning_time: "07:00",
    briefing_evening_time: "18:00",
    briefing_timezone: "America/Los_Angeles",
  };
  return NextResponse.json({ ok: true, settings: row });
}

export async function PATCH(req: Request) {
  let ctx;
  try {
    ctx = await getCurrentAgentContext();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: Partial<SettingsRow>;
  try {
    body = (await req.json()) as Partial<SettingsRow>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const update: Partial<SettingsRow> = {};
  if (body.briefing_morning_time !== undefined) {
    const v = String(body.briefing_morning_time).trim();
    if (!HHMM_RE.test(v)) {
      return NextResponse.json(
        { ok: false, error: "Morning time must be HH:MM (24-hour)." },
        { status: 400 },
      );
    }
    update.briefing_morning_time = v;
  }
  if (body.briefing_evening_time !== undefined) {
    const v = String(body.briefing_evening_time).trim();
    if (!HHMM_RE.test(v)) {
      return NextResponse.json(
        { ok: false, error: "Evening time must be HH:MM (24-hour)." },
        { status: 400 },
      );
    }
    update.briefing_evening_time = v;
  }
  if (body.briefing_timezone !== undefined) {
    const v = String(body.briefing_timezone).trim();
    if (!isValidTimezone(v)) {
      return NextResponse.json(
        { ok: false, error: "Unknown IANA timezone." },
        { status: 400 },
      );
    }
    update.briefing_timezone = v;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { ok: false, error: "No fields to update." },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("agents")
    .update(update)
    .eq("id", ctx.agentId)
    .select("briefing_morning_time, briefing_evening_time, briefing_timezone")
    .single();
  if (error) {
    console.error("[briefing-settings] patch", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, settings: data });
}

/**
 * Validate an IANA timezone string by asking Intl whether it can
 * format a date in that zone. Avoids us hardcoding a list.
 */
function isValidTimezone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}
