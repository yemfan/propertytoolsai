import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { findPropertyMatches, parseMatchPreferences } from "@/lib/match/findMatches";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function authorize(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Daily digest for subscribed Smart Match searches.
 * Schedule via Vercel Cron or similar: GET /api/cron/smart-match-daily
 */
export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: rows, error } = await supabaseAdmin
      .from("lead_saved_searches")
      .select("id, lead_id, preferences, last_sent_at");

    if (error) throw error;

    const cutoff = Date.now() - 23 * 60 * 60 * 1000;
    const due =
      rows?.filter((r) => {
        if (!r.last_sent_at) return true;
        return new Date(r.last_sent_at).getTime() < cutoff;
      }) ?? [];

    let sent = 0;

    for (const row of due) {
      const prefsRaw = row.preferences;
      const prefs = parseMatchPreferences(prefsRaw);
      if (!prefs) continue;

      const { data: leadRow } = await supabaseAdmin
        .from("leads")
        .select("email, name")
        .eq("id", row.lead_id)
        .maybeSingle();

      const to = leadRow?.email?.trim();
      if (!to) continue;

      const { matches } = await findPropertyMatches(prefs);
      const top = matches.slice(0, 3);
      if (!top.length) continue;

      const lines = top.map((m) => `- ${m.address} — $${m.price.toLocaleString()}`).join("\n");
      const greeting = leadRow?.name?.trim() || "there";
      const body = `Hi ${greeting},

Here are new homes matching your preferences:

${lines}

Want to see more or schedule a tour? Reply to this email.`;

      await sendEmail({
        to,
        subject: "New homes matching your search",
        text: body,
      });

      await supabaseAdmin
        .from("lead_saved_searches")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("id", row.id);

      sent += 1;
    }

    return NextResponse.json({ ok: true, processed: due.length, emailsSent: sent });
  } catch (e) {
    console.error("smart-match-daily cron", e);
    return NextResponse.json({ ok: false, error: "Cron failed" }, { status: 500 });
  }
}
