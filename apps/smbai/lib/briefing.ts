import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/server";

// Plain server module. Turns the dashboard's signals into a plain-English
// "what needs you today" briefing, cached once per org per day.

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-haiku-4-5";

export type BriefingSignals = {
  overdueCount: number;
  overdueAmount: number;
  unreadMessages: number;
  urgentMessages: number;
  tasksOverdue: number;
  tasksDueToday: number;
  lowestProjectedCash: number | null;
  uninvoicedAmount: number;
};

export type Briefing = { headline: string; actions: string[] };

const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** Deterministic briefing used when the AI is unavailable. */
function fallback(s: BriefingSignals): Briefing {
  const actions: string[] = [];
  if (s.overdueCount > 0) {
    actions.push(`Chase ${s.overdueCount} overdue invoice${s.overdueCount !== 1 ? "s" : ""} (${dollars(s.overdueAmount)})`);
  }
  if (s.urgentMessages > 0) {
    actions.push(`Reply to ${s.urgentMessages} urgent message${s.urgentMessages !== 1 ? "s" : ""}`);
  } else if (s.unreadMessages > 0) {
    actions.push(`${s.unreadMessages} unread message${s.unreadMessages !== 1 ? "s" : ""} waiting in the inbox`);
  }
  const tasks = s.tasksOverdue + s.tasksDueToday;
  if (tasks > 0) actions.push(`${tasks} task${tasks !== 1 ? "s" : ""} need attention today`);
  return {
    headline: actions.length ? "Here's what needs you today." : "You're all caught up — nothing pressing today.",
    actions: actions.slice(0, 3),
  };
}

export async function getOrCreateDailyBriefing(orgId: string, signals: BriefingSignals): Promise<Briefing> {
  const s = signals;
  const db = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  // Cached once per org per day.
  const { data: existing } = await db
    .from("daily_briefings")
    .select("headline, actions")
    .eq("organization_id", orgId)
    .eq("briefing_date", today)
    .maybeSingle();
  if (existing) {
    return { headline: existing.headline as string, actions: (existing.actions as string[]) ?? [] };
  }

  let briefing: Briefing;
  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `You are a small-business owner's assistant writing their morning briefing. Today's numbers:
- Overdue invoices: ${s.overdueCount} totaling ${dollars(s.overdueAmount)}
- Unread inbox messages: ${s.unreadMessages} (${s.urgentMessages} marked urgent)
- Tasks: ${s.tasksOverdue} overdue, ${s.tasksDueToday} due today
- Uninvoiced billable time: ${dollars(s.uninvoicedAmount)}${
            s.lowestProjectedCash !== null && s.lowestProjectedCash < 0
              ? `\n- WARNING: projected cash dips to ${dollars(s.lowestProjectedCash)} within 90 days`
              : ""
          }

Return ONLY a JSON object: {"headline":"one warm, specific sentence","actions":["up to 3 prioritized, specific items, most urgent first, with the numbers — e.g. 'Chase $1,200 across 2 overdue invoices'"]}.
Only include actions that genuinely need the owner today. If nothing is pressing, the headline says they're caught up and actions is [].`,
        },
      ],
    });
    const raw = res.content[0]?.type === "text" ? res.content[0].text : "";
    const m = raw.match(/\{[\s\S]*\}/);
    const parsed = m ? (JSON.parse(m[0]) as { headline?: unknown; actions?: unknown }) : null;
    briefing =
      parsed && typeof parsed.headline === "string"
        ? {
            headline: parsed.headline,
            actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 3).map(String) : [],
          }
        : fallback(s);
  } catch {
    briefing = fallback(s);
  }

  await db.from("daily_briefings").upsert(
    { organization_id: orgId, briefing_date: today, headline: briefing.headline, actions: briefing.actions },
    { onConflict: "organization_id,briefing_date" }
  );
  return briefing;
}
