/**
 * JSON Schema for OpenAI Responses API structured outputs (`text.format.type: json_schema`).
 * Keep in sync with {@link VoiceCallIntent} and Zod parsing in `voice-transcript-analysis.ts`.
 */
export const VOICE_TRANSCRIPT_ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "inferred_intent", "hot_lead", "needs_human", "reasoning"],
  properties: {
    summary: {
      type: "string",
      description: "2–4 sentences, professional; no legal/tax advice.",
    },
    inferred_intent: {
      type: "string",
      enum: [
        "buyer_listing_inquiry",
        "buyer_financing",
        "seller_home_value",
        "seller_list_home",
        "appointment",
        "support",
        "unknown",
      ],
      description: "Primary real-estate intent for CRM routing.",
    },
    hot_lead: {
      type: "boolean",
      description: "Strong sales signal: ready to move, urgent timeline, wants callback/showing soon.",
    },
    needs_human: {
      type: "boolean",
      description: "Escalate: legal threat, harassment, fraud, discrimination, or insists on licensed agent now.",
    },
    reasoning: {
      type: "object",
      additionalProperties: false,
      required: ["intent", "hot_lead", "needs_human"],
      properties: {
        intent: {
          type: "string",
          description: "One short clause: why this inferred_intent.",
        },
        hot_lead: {
          type: "string",
          description: "One short clause: why hot_lead flag.",
        },
        needs_human: {
          type: "string",
          description: "One short clause: why needs_human flag.",
        },
      },
    },
  },
} as const;
