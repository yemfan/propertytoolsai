import OpenAI from "openai";
import { calculateContactCompletenessScore, displayAddress, displayPhone } from "./normalize";
import type { EnrichmentResult, LeadLike } from "./types";

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

function enrichmentModel() {
  return (
    process.env.OPENAI_ENRICHMENT_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-4o-mini"
  );
}

function leadPayload(lead: LeadLike) {
  return {
    name: lead.name,
    email: lead.email,
    phone: displayPhone(lead),
    source: lead.source,
    intent: lead.ai_intent ?? lead.intent,
    lead_temperature: lead.rating ?? lead.lead_temperature,
    relationship_stage: lead.relationship_stage,
    notes_summary: lead.notes_summary,
    notes_excerpt:
      typeof lead.notes === "string" ? lead.notes.slice(0, 2000) : null,
    address: displayAddress(lead),
    city: lead.city,
    state: lead.state,
    zip_code: lead.zip_code,
  };
}

export async function enrichLeadRecord(lead: LeadLike): Promise<EnrichmentResult> {
  const completeness = calculateContactCompletenessScore(lead);
  const openai = getOpenAI();

  if (!openai) {
    return {
      contactCompletenessScore: completeness,
      changes: {},
    };
  }

  const userPrompt = `
Analyze this real estate CRM lead and infer the best contact classification.

Lead JSON:
${JSON.stringify(leadPayload(lead))}

Return strict JSON:
{
  "inferredContactType": string | null,
  "inferredLifecycleStage": string | null,
  "preferredContactChannel": string | null,
  "preferredContactTime": string | null,
  "notesSummary": string | null
}

Use null when unknown. inferredContactType examples: buyer, seller, investor, past_client, referral_partner.
preferredContactChannel: sms, email, or both when appropriate.
preferredContactTime: short phrase like "weekday mornings" or null.
notesSummary: at most 2 sentences; null if no useful summary.
`;

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      inferredContactType: { type: ["string", "null"] },
      inferredLifecycleStage: { type: ["string", "null"] },
      preferredContactChannel: { type: ["string", "null"] },
      preferredContactTime: { type: ["string", "null"] },
      notesSummary: { type: ["string", "null"] },
    },
    required: [
      "inferredContactType",
      "inferredLifecycleStage",
      "preferredContactChannel",
      "preferredContactTime",
      "notesSummary",
    ],
  } as const;

  try {
    const response = await openai.responses.create({
      model: enrichmentModel(),
      instructions:
        "You output only valid JSON for CRM lead enrichment. Follow the user schema exactly.",
      input: [{ role: "user", content: userPrompt }],
      text: {
        format: {
          type: "json_schema",
          name: "lead_enrichment",
          strict: true,
          schema: schema as unknown as Record<string, unknown>,
        },
      },
    });

    const outputText = response.output_text?.trim();
    if (!outputText) throw new Error("empty output");
    const parsed = JSON.parse(outputText) as {
      inferredContactType: string | null;
      inferredLifecycleStage: string | null;
      preferredContactChannel: string | null;
      preferredContactTime: string | null;
      notesSummary: string | null;
    };

    const changes: Record<string, unknown> = {
      inferred_contact_type: parsed.inferredContactType,
      inferred_lifecycle_stage: parsed.inferredLifecycleStage,
      preferred_contact_channel: parsed.preferredContactChannel,
      preferred_contact_time: parsed.preferredContactTime,
      notes_summary: parsed.notesSummary,
    };

    return {
      inferredContactType: parsed.inferredContactType,
      inferredLifecycleStage: parsed.inferredLifecycleStage,
      preferredContactChannel: parsed.preferredContactChannel,
      preferredContactTime: parsed.preferredContactTime,
      notesSummary: parsed.notesSummary,
      contactCompletenessScore: completeness,
      changes,
    };
  } catch {
    return {
      contactCompletenessScore: completeness,
      changes: {},
    };
  }
}
