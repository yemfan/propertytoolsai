type BriefingInput = {
  hotLeads: Array<{ name: string; score: number; address: string }>;
  highEngagementLeads: Array<{ name: string; score: number; address: string }>;
  inactiveLeads: Array<{ name: string; daysInactive: number; address: string }>;
  totalLeads: number;
};

type BriefingOutput = {
  summary: string;
  insights: {
    topHotLeads: Array<{ name: string; score: number; address: string }>;
    needsFollowUp: Array<{ name: string; daysInactive: number; address: string }>;
    topOpportunity: string;
    suggestedActions: string[];
  };
};

function fallbackBriefing(input: BriefingInput): BriefingOutput {
  const topHot = input.hotLeads.slice(0, 3);
  const followUp = input.inactiveLeads.slice(0, 3);
  const topOpportunity =
    topHot[0]?.name
      ? `${topHot[0].name} (${topHot[0].address || "no address"}) shows the strongest buying/selling signal today.`
      : "No standout opportunity yet; prioritize re-engaging inactive leads.";

  const suggestedActions = [
    topHot.length ? "Call top hot leads first this morning." : "Review new inquiries and qualify intent.",
    followUp.length
      ? "Send follow-up messages to leads inactive for 7+ days."
      : "Keep engagement momentum with active leads.",
    "Schedule one personalized CMA/report update for your best opportunity.",
  ];

  const summary = `Today you have ${input.totalLeads} tracked leads, ${input.hotLeads.length} hot leads, ${input.highEngagementLeads.length} high-engagement leads, and ${input.inactiveLeads.length} inactive leads. Focus first on high-intent hot leads, then re-engage inactive contacts with a short personalized follow-up.`;

  return {
    summary,
    insights: {
      topHotLeads: topHot,
      needsFollowUp: followUp,
      topOpportunity,
      suggestedActions,
    },
  };
}

export async function generateDailyBriefing(input: BriefingInput): Promise<BriefingOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallbackBriefing(input);

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const prompt = `Summarize today's real estate leads for an agent.

Include:
- top hot leads
- leads needing follow-up
- top opportunity
- suggested actions

Return strict JSON only in this shape:
{
  "summary": "string",
  "insights": {
    "topHotLeads": [{"name":"string","score":0,"address":"string"}],
    "needsFollowUp": [{"name":"string","daysInactive":0,"address":"string"}],
    "topOpportunity": "string",
    "suggestedActions": ["string","string","string"]
  }
}

Data:
${JSON.stringify(input)}
`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        { role: "system", content: "You generate concise actionable daily CRM briefings." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) return fallbackBriefing(input);
  const json = (await res.json()) as any;
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) return fallbackBriefing(input);

  try {
    const parsed = JSON.parse(content) as BriefingOutput;
    if (!parsed?.summary || !parsed?.insights) return fallbackBriefing(input);
    return parsed;
  } catch {
    return fallbackBriefing(input);
  }
}

