export type SmsChatMessage = {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

type GenerateSmsReplyParams = {
  incomingMessage: string;
  history: SmsChatMessage[];
  leadName?: string | null;
  propertyAddress?: string | null;
  agentName?: string | null;
  leadStage?: "new" | "warm" | "hot" | string;
};

const SYSTEM_PROMPT =
  "You are a friendly real estate assistant. Keep responses to at most 2 sentences, conversational, and move the lead toward a real conversation. Ask exactly one follow-up question. Do not be salesy.";

export async function generateSmsReply(params: GenerateSmsReplyParams): Promise<string> {
  const fallback = () => {
    const name = params.leadName ? String(params.leadName) : "there";
    const addr = params.propertyAddress ? String(params.propertyAddress) : "";
    return `Hi ${name} — thanks for reaching out${addr ? ` about ${addr}` : ""}. Would you like to schedule a quick call so I can share pricing and next steps?`;
  };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback();

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const safeHistory = (params.history ?? []).slice(-8);
  const historyText = safeHistory
    .map((m) => `${m.role === "user" ? "Lead" : "Assistant"}: ${m.content}`)
    .join("\n");

  const leadStage = params.leadStage ? String(params.leadStage) : "new";

  const prompt = `Lead stage: ${leadStage}\nLead name: ${params.leadName ?? ""}\nAgent name: ${params.agentName ?? ""}\nProperty: ${params.propertyAddress ?? ""}\n\nConversation so far:\n${historyText || "(no prior messages)"}\n\nLatest incoming SMS:\n${params.incomingMessage}\n\nWrite the best reply in 1-2 short sentences. It must include exactly one follow-up question and sound helpful, not pushy.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) return fallback();
  const json = (await res.json()) as any;
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) return fallback();

  // Keep replies short and remove accidental long signatures.
  return content.trim();
}

