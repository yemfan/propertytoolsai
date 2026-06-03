/**
 * GET /api/cron/voice/reminders
 *
 * Every few minutes: for each org with appointment reminders enabled, schedule
 * reminder calls for appointments that have entered the lead window, then place
 * any due calls (staggered, within calling hours). Runs via Vercel Cron.
 * Iterates every vertical (Core + medical, …) so each project's orgs are served.
 *
 * Auth: Bearer CRON_SECRET (Vercel sets this when crons are configured in
 * vercel.json and sends it automatically).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClientFor, packServiceConns } from "@/lib/supabase/server";
import { scheduleDueReminders, drainOutboundQueue } from "@/lib/outbound-queue";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let orgCount = 0;
  let scheduled = 0;
  let placed = 0;

  // Process every vertical's orgs — Core plus the medical project (if configured).
  for (const conn of packServiceConns()) {
    const db = createServiceClientFor(conn);
    const { data: orgs } = await db
      .from("organizations")
      .select("id, voice_reminder_lead_minutes, twilio_number")
      .eq("voice_reminder_enabled", true)
      .not("twilio_number", "is", null);

    orgCount += orgs?.length ?? 0;
    for (const org of orgs ?? []) {
      const orgId = org.id as string;
      const lead = (org.voice_reminder_lead_minutes as number) || 1440;
      scheduled += await scheduleDueReminders(db, orgId, lead);
      const res = await drainOutboundQueue(db, orgId, { limit: 25, staggerMs: 1500 });
      placed += res.placed;
    }
  }

  return NextResponse.json({ ok: true, orgs: orgCount, scheduled, placed });
}
