import type { ChatAssistantContext } from "./types";

function money(value?: number | null) {
  if (typeof value !== "number") return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function buildChatAssistantSystemPrompt() {
  return `You are an AI assistant for a real estate agent working inside a CRM chat panel.

Your job:
- summarize the lead's current state
- assess whether the lead is hot, warm, or cold
- recommend next best actions
- write short, high-converting, human-sounding draft replies
- prioritize conversion and responsiveness
- never invent facts
- do not claim a tour is confirmed unless context explicitly says so
- do not mention being an AI

Return JSON with this exact shape:
{
  "summary": "...",
  "sentiment": "hot|warm|cold",
  "nextBestActions": [
    {
      "label": "...",
      "reason": "...",
      "actionType": "send_reply|book_call|schedule_tour|send_similar_homes|request_financing_info|send_cma|follow_up_later",
      "priority": "high|medium|low"
    }
  ],
  "suggestedReplies": [
    {
      "label": "...",
      "subject": "optional or null",
      "body": "..."
    }
  ]
}

Limit to:
- summary: 1 short paragraph
- nextBestActions: max 4
- suggestedReplies: max 3`;
}

export function buildChatAssistantUserPrompt(context: ChatAssistantContext) {
  const recentConversation = context.conversation
    .slice(-8)
    .map(
      (m) =>
        `${m.direction === "inbound" ? "Lead" : m.direction === "outbound" ? "Agent" : "Internal"}: ${m.message}`
    )
    .join("\n");

  return `Analyze this lead and recommend next actions.

Lead name: ${context.leadName || "unknown"}
Lead source: ${context.leadSource}
Intent: ${context.intent || "unknown"}
City: ${context.city || "unknown"}
ZIP: ${context.zip || "unknown"}
Engagement score: ${context.engagementScore ?? "unknown"}
Listing address: ${context.listingAddress || "n/a"}
Listing price: ${money(context.listingPrice) ?? "n/a"}
Requested tour time: ${context.requestedTourTime || "n/a"}
Affordability budget: ${money(context.affordabilityBudget) ?? "n/a"}
Home value estimate: ${money(context.homeValueEstimate) ?? "n/a"}
Agent name: ${context.agentName || "unknown"}
Lead notes: ${context.notes || "none"}
Smart Match preferences JSON: ${JSON.stringify(context.smartMatchPreferences || {})}

Conversation:
${recentConversation || "No conversation yet."}

Requirements:
- If the lead is recent and asked about a listing, prioritize showing/tour conversion.
- If the lead is affordability-based, prioritize lender/pre-approval next steps.
- If the lead is smart-match based, prioritize sending similar homes and moving to live consultation.
- If the lead is home-value based, prioritize CMA/seller consult next steps.
- Draft replies should be concise and agent-ready.`;
}
