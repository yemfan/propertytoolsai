import type { LeadReplyContext, ReplyGoal, ReplyTone } from "./types";

function money(value?: number) {
  if (typeof value !== "number") return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildContextSummary(context: LeadReplyContext) {
  return [
    `Lead source: ${context.leadSource}`,
    `Intent: ${context.intent || "unknown"}`,
    `Lead name: ${context.leadName || "unknown"}`,
    context.listing?.listingAddress ? `Listing: ${context.listing.listingAddress}` : null,
    typeof context.listing?.price === "number" ? `Listing price: ${money(context.listing.price)}` : null,
    context.listing?.requestedTime ? `Requested tour time: ${context.listing.requestedTime}` : null,
    typeof context.buyer?.maxHomePrice === "number" ? `Buyer budget: ${money(context.buyer.maxHomePrice)}` : null,
    context.buyer?.timeline ? `Timeline: ${context.buyer.timeline}` : null,
    typeof context.buyer?.alreadyPreapproved === "boolean"
      ? `Already pre-approved: ${context.buyer.alreadyPreapproved ? "yes" : "no"}`
      : null,
    typeof context.buyer?.firstTimeBuyer === "boolean"
      ? `First-time buyer: ${context.buyer.firstTimeBuyer ? "yes" : "no"}`
      : null,
    typeof context.buyer?.veteran === "boolean"
      ? `Veteran/VA eligible: ${context.buyer.veteran ? "yes" : "no"}`
      : null,
    context.notes ? `Lead notes: ${context.notes}` : null,
    context.latestInboundMessage ? `Latest inbound message: ${context.latestInboundMessage}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildConversationSummary(context: LeadReplyContext) {
  const recent = context.conversation.slice(-6);
  if (!recent.length) return "No prior conversation history.";

  return recent
    .map((msg) => {
      const speaker =
        msg.direction === "inbound" ? "Lead" : msg.direction === "outbound" ? "Agent" : "Internal";
      return `${speaker}: ${msg.message}`;
    })
    .join("\n");
}

export function buildReplySystemPrompt() {
  return `You are an AI reply assistant for a real estate agent CRM.

Your job:
- write short, natural, high-converting replies
- sound human, warm, professional, and clear
- avoid being robotic or overly salesy
- focus on next-step conversion
- never invent facts not present in context
- if information is missing, use neutral wording
- do not claim tours are confirmed unless the agent explicitly confirms
- do not mention being an AI
- if the user message includes an AGENT PLAYBOOK section, align tone and next-step priorities with it when it does not conflict with lead facts

Return JSON with this shape:
{
  "reasoningSummary": "...",
  "suggestions": [
    {
      "label": "...",
      "tone": "professional|friendly|urgent|consultative",
      "goal": "answer_question|book_tour|move_to_call|collect_financing_info|send_similar_homes|general_followup",
      "subject": "optional",
      "body": "..."
    }
  ]
}

Write 3 reply suggestions max.`;
}

function buildPlaybookSection(context: LeadReplyContext): string {
  const text = context.agentPlaybookSummary?.trim();
  if (!text) return "";
  return `

AGENT PLAYBOOK
${text}
`;
}

export function buildReplyUserPrompt(context: LeadReplyContext) {
  return `Generate suggested replies for this real estate lead.

CONTEXT
${buildContextSummary(context)}

RECENT CONVERSATION
${buildConversationSummary(context)}${buildPlaybookSection(context)}

Requirements:
- Suggest 3 different replies max
- Keep each reply concise but useful
- Prioritize moving the lead to a next action
- For listing leads, prioritize showings, confirming interest, and offering similar homes
- For affordability leads, prioritize lender match, pre-approval, and budget clarification
- For home value leads, prioritize CMA, seller consultation, and timing discussion
- When an AGENT PLAYBOOK section is present above, use it to guide phrasing and next steps without inventing offers or policies not stated there
- Mention the agent name only if helpful: ${context.agentName || "not available"}`;
}

export function buildFallbackSuggestions(context: LeadReplyContext): {
  reasoningSummary: string;
  suggestions: {
    label: string;
    tone: ReplyTone;
    goal: ReplyGoal;
    subject?: string | null;
    body: string;
  }[];
} {
  if (context.leadSource === "listing_inquiry") {
    const address = context.listing?.listingAddress || "the home";
    return {
      reasoningSummary: "These replies focus on converting listing interest into a showing or live conversation.",
      suggestions: [
        {
          label: "Confirm interest",
          tone: "friendly",
          goal: "book_tour",
          subject: `Re: ${address}`,
          body: `Hi ${context.leadName || "there"}, thanks for your interest in ${address}. I'd be happy to help with details or set up a showing. Are you available sometime today or tomorrow to take the next step?`,
        },
        {
          label: "Offer similar homes",
          tone: "consultative",
          goal: "send_similar_homes",
          subject: `Options similar to ${address}`,
          body: `Hi ${context.leadName || "there"}, thanks for reaching out about ${address}. If you'd like, I can also send you a few similar homes in the same area and price range so you can compare your options more easily.`,
        },
        {
          label: "Move to call",
          tone: "professional",
          goal: "move_to_call",
          subject: `Quick follow-up on ${address}`,
          body: `Hi ${context.leadName || "there"}, I can help answer questions about ${address} and walk you through next steps. If it's easier, we can do a quick call and I can help you faster from there.`,
        },
      ],
    };
  }

  if (context.leadSource === "affordability_report") {
    return {
      reasoningSummary:
        "These replies focus on moving the buyer toward lender qualification and home search readiness.",
      suggestions: [
        {
          label: "Pre-approval next step",
          tone: "consultative",
          goal: "collect_financing_info",
          subject: "Next step after your affordability report",
          body: `Hi ${context.leadName || "there"}, thanks for reviewing your affordability report. The next best step is to confirm your financing so we know your real budget range and can shop more confidently. Would you like help comparing lender options?`,
        },
        {
          label: "Budget clarification",
          tone: "friendly",
          goal: "answer_question",
          subject: "Your buying power",
          body: `Hi ${context.leadName || "there"}, I'm happy to help break down what your affordability result means in real terms, including monthly payment and what kind of homes might fit your budget.`,
        },
        {
          label: "Move into search",
          tone: "professional",
          goal: "general_followup",
          subject: "Homes in your price range",
          body: `Hi ${context.leadName || "there"}, based on your affordability range, I can put together homes that match your budget and preferred area so you can see what's realistic in today's market.`,
        },
      ],
    };
  }

  if (context.leadSource === "home_value_estimate") {
    return {
      reasoningSummary:
        "These replies focus on seller consultation, pricing clarity, and timing for a potential listing.",
      suggestions: [
        {
          label: "CMA offer",
          tone: "consultative",
          goal: "general_followup",
          subject: "Your home value estimate",
          body: `Hi ${context.leadName || "there"}, thanks for reviewing your home value estimate. If you'd like, I can put together a more detailed market comparison for your home so you can see how it stacks up against recent nearby sales.`,
        },
        {
          label: "Timing discussion",
          tone: "friendly",
          goal: "move_to_call",
          subject: "Next steps if you're considering selling",
          body: `Hi ${context.leadName || "there"}, happy to talk through timing, prep, and what a realistic listing strategy might look like based on your goals. Would a quick call this week work for you?`,
        },
        {
          label: "Answer questions",
          tone: "professional",
          goal: "answer_question",
          subject: null,
          body: `Hi ${context.leadName || "there"}, I'm here to help if you have questions about the estimate, what buyers are doing in your area, or what improvements tend to matter most for value.`,
        },
      ],
    };
  }

  return {
    reasoningSummary: "These replies focus on getting the lead into a live consultation.",
    suggestions: [
      {
        label: "General follow-up",
        tone: "professional",
        goal: "general_followup",
        subject: null,
        body: `Hi ${context.leadName || "there"}, thanks for reaching out. I'd be happy to help with your next steps and answer any questions you have. Let me know what would be most helpful.`,
      },
      {
        label: "Move to call",
        tone: "friendly",
        goal: "move_to_call",
        subject: null,
        body: `Hi ${context.leadName || "there"}, happy to help. If you'd like, we can do a quick call so I can understand exactly what you need and point you in the right direction faster.`,
      },
    ],
  };
}
