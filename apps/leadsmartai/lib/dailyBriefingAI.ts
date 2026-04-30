/**
 * AI-driven generator for the morning briefing AND the evening summary.
 *
 * Two kinds:
 *   - 'morning'  — start-of-day plan (what to do today, who to call first)
 *   - 'evening'  — end-of-day summary (what got done, what to revisit tomorrow)
 *
 * Falls back to a deterministic template when OPENAI_API_KEY is not
 * set so the cron stays useful even without AI configured. Both
 * kinds emit a one-line emoji-flavored `headline` that the dashboard
 * card uses as its title — keeps the surface inviting instead of a
 * wall of text.
 */

export type BriefingKind = "morning" | "evening";

type LeadDelta = { name: string; score: number; address: string };
type FollowUpDelta = { name: string; daysInactive: number; address: string };

export type MorningBriefingInput = {
  kind: "morning";
  hotLeads: LeadDelta[];
  highEngagementLeads: LeadDelta[];
  inactiveLeads: FollowUpDelta[];
  totalLeads: number;
};

export type EveningBriefingInput = {
  kind: "evening";
  /** Tasks the agent ticked off today. */
  completedTasks: Array<{ title: string; type: string }>;
  /** Tasks that came due today but were not completed. */
  missedTasks: Array<{ title: string; type: string }>;
  /** Conversations had today (sms/email/calls). */
  conversationsCount: number;
  /** New leads created today. */
  newLeadsCount: number;
  /** Tasks queued for tomorrow. */
  tomorrowTasks: Array<{ title: string; type: string }>;
};

export type BriefingInput = MorningBriefingInput | EveningBriefingInput;

export type BriefingOutput = {
  /** One-line emoji-flavored hook used as the card title. */
  headline: string;
  /** 2-4 sentence prose summary used as the card body. */
  summary: string;
  insights: {
    /** Used by morning to surface hot leads. */
    topHotLeads?: LeadDelta[];
    /** Used by morning to surface aging follow-ups. */
    needsFollowUp?: FollowUpDelta[];
    /** Used by evening to recap completed work. */
    completedTasks?: Array<{ title: string; type: string }>;
    /** Used by evening to flag rollover work. */
    missedTasks?: Array<{ title: string; type: string }>;
    /** Used by evening to preview tomorrow. */
    tomorrowTasks?: Array<{ title: string; type: string }>;
    /** Free-text "best opportunity to act on" headline. */
    topOpportunity: string;
    suggestedActions: string[];
  };
};

const MORNING_EMOJI = ["☀️", "🚀", "📞", "🔥", "🏡"];
const EVENING_EMOJI = ["🌙", "✅", "📊", "🎯", "💡"];

function pickEmoji(kind: BriefingKind, seed: number): string {
  const pool = kind === "morning" ? MORNING_EMOJI : EVENING_EMOJI;
  return pool[seed % pool.length] ?? pool[0];
}

function fallbackMorning(input: MorningBriefingInput): BriefingOutput {
  const topHot = input.hotLeads.slice(0, 3);
  const followUp = input.inactiveLeads.slice(0, 3);
  const topOpportunity = topHot[0]?.name
    ? `${topHot[0].name} (${topHot[0].address || "no address"}) shows the strongest buying signal today.`
    : "No standout opportunity yet — prioritize re-engaging inactive leads.";
  const suggestedActions = [
    topHot.length ? "Call top hot leads first thing." : "Review new inquiries and qualify intent.",
    followUp.length
      ? "Send a personalized follow-up to leads inactive 7+ days."
      : "Keep momentum with high-engagement leads.",
    "Schedule one CMA or market-update share for your best opportunity.",
  ];
  const headline =
    topHot[0]?.name
      ? `☀️ ${topHot.length} hot lead${topHot.length === 1 ? "" : "s"} ready — start with ${topHot[0].name}`
      : `☀️ Fresh day, ${input.totalLeads} lead${input.totalLeads === 1 ? "" : "s"} in your pipeline`;
  const summary = `You have ${input.totalLeads} tracked leads — ${input.hotLeads.length} 🔥 hot, ${input.highEngagementLeads.length} 💬 high-engagement, ${input.inactiveLeads.length} 💤 inactive. Hit the hot list first, then re-engage anyone past 7 days dark.`;
  return {
    headline,
    summary,
    insights: {
      topHotLeads: topHot,
      needsFollowUp: followUp,
      topOpportunity,
      suggestedActions,
    },
  };
}

function fallbackEvening(input: EveningBriefingInput): BriefingOutput {
  const done = input.completedTasks.length;
  const missed = input.missedTasks.length;
  const newLeads = input.newLeadsCount;
  const conv = input.conversationsCount;
  const winLine =
    done >= 5
      ? `🎯 Strong day — ${done} task${done === 1 ? "" : "s"} done.`
      : done > 0
      ? `✅ ${done} task${done === 1 ? "" : "s"} cleared.`
      : `🌙 Quiet day on tasks — let's queue tomorrow up.`;
  const headline =
    missed > 0
      ? `🌙 ${done} done, ${missed} rolling over to tomorrow`
      : winLine;
  const tomorrowLine = input.tomorrowTasks.length
    ? `Tomorrow has ${input.tomorrowTasks.length} task${input.tomorrowTasks.length === 1 ? "" : "s"} queued.`
    : "Tomorrow is open — block the morning for prospecting.";
  const summary = `${winLine} ${conv ? `💬 ${conv} conversation${conv === 1 ? "" : "s"}.` : ""} ${newLeads ? `✨ ${newLeads} new lead${newLeads === 1 ? "" : "s"} captured.` : ""} ${tomorrowLine}`.trim();
  const topOpportunity = input.missedTasks[0]?.title
    ? `Roll "${input.missedTasks[0].title}" into tomorrow's first slot.`
    : input.tomorrowTasks[0]?.title
      ? `Lead off tomorrow with "${input.tomorrowTasks[0].title}".`
      : "Block the first hour tomorrow for outbound prospecting.";
  const suggestedActions = [
    missed ? `Reschedule ${missed} missed task${missed === 1 ? "" : "s"} to tomorrow morning.` : "Pre-plan tomorrow's first three calls before signing off.",
    conv ? "Log any verbal next steps from today's conversations." : "Send one personalized check-in before EOD.",
    "Update pipeline stage on any deals that moved today.",
  ];
  return {
    headline,
    summary,
    insights: {
      completedTasks: input.completedTasks.slice(0, 5),
      missedTasks: input.missedTasks.slice(0, 5),
      tomorrowTasks: input.tomorrowTasks.slice(0, 5),
      topOpportunity,
      suggestedActions,
    },
  };
}

function fallback(input: BriefingInput): BriefingOutput {
  return input.kind === "morning" ? fallbackMorning(input) : fallbackEvening(input);
}

function buildPrompt(input: BriefingInput): string {
  if (input.kind === "morning") {
    return `Generate a MORNING start-of-day briefing for a real estate agent. Be punchy, specific, and use 1-2 emojis sparingly to add color (don't overdo it).

Return STRICT JSON only in this shape:
{
  "headline": "1-line hook with one emoji at the start, max 90 chars",
  "summary": "2-3 sentences of plain prose with maybe one emoji",
  "insights": {
    "topHotLeads": [{"name":"string","score":0,"address":"string"}],
    "needsFollowUp": [{"name":"string","daysInactive":0,"address":"string"}],
    "topOpportunity": "1 sentence",
    "suggestedActions": ["string","string","string"]
  }
}

Data: ${JSON.stringify(input)}`;
  }
  return `Generate an EVENING end-of-day summary for a real estate agent. Recap wins, flag rollovers, preview tomorrow. Be celebratory when there are wins, honest when not. Use 1-2 emojis sparingly.

Return STRICT JSON only in this shape:
{
  "headline": "1-line hook with one emoji at the start, max 90 chars",
  "summary": "2-3 sentences of plain prose with maybe one emoji",
  "insights": {
    "completedTasks": [{"title":"string","type":"string"}],
    "missedTasks": [{"title":"string","type":"string"}],
    "tomorrowTasks": [{"title":"string","type":"string"}],
    "topOpportunity": "1 sentence — what to lead with tomorrow",
    "suggestedActions": ["string","string","string"]
  }
}

Data: ${JSON.stringify(input)}`;
}

export async function generateDailyBriefing(input: BriefingInput): Promise<BriefingOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback(input);

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const prompt = buildPrompt(input);
  const systemMsg =
    input.kind === "morning"
      ? "You generate concise, energizing morning CRM briefings. JSON output only."
      : "You generate concise, honest evening CRM summaries. JSON output only.";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) return fallback(input);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) return fallback(input);

  try {
    const parsed = JSON.parse(content) as Partial<BriefingOutput>;
    if (!parsed?.summary || !parsed?.insights) return fallback(input);
    // Backfill headline if the model omitted it — emoji-flavored, deterministic.
    const headline =
      parsed.headline?.trim() ||
      (() => {
        const seed = (input.kind === "morning" ? input.totalLeads : input.completedTasks.length) ?? 0;
        const e = pickEmoji(input.kind, seed);
        return `${e} ${parsed.summary.slice(0, 80)}`;
      })();
    return {
      headline,
      summary: parsed.summary,
      insights: {
        topHotLeads: parsed.insights.topHotLeads,
        needsFollowUp: parsed.insights.needsFollowUp,
        completedTasks: parsed.insights.completedTasks,
        missedTasks: parsed.insights.missedTasks,
        tomorrowTasks: parsed.insights.tomorrowTasks,
        topOpportunity: parsed.insights.topOpportunity ?? "",
        suggestedActions: parsed.insights.suggestedActions ?? [],
      },
    };
  } catch {
    return fallback(input);
  }
}
