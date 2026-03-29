import OpenAI from "openai";
import type { AiPipelinePlan, CrmTaskRow, PipelineStageRow } from "./types";

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

function model() {
  return (
    process.env.OPENAI_PIPELINE_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-4o-mini"
  );
}

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    recommendedStageSlug: { type: ["string", "null"] },
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          description: { type: ["string", "null"] },
          dueInDays: { type: ["integer", "null"] },
          priority: {
            type: "string",
            enum: ["low", "normal", "high", "urgent"],
          },
        },
        required: ["title", "description", "dueInDays", "priority"],
      },
    },
  },
  required: ["summary", "recommendedStageSlug", "tasks"],
} as const;

function fallbackPlan(
  stages: PipelineStageRow[],
  openTasks: CrmTaskRow[]
): AiPipelinePlan {
  const slug = stages.find((s) => s.slug === "contacted")?.slug ?? stages[0]?.slug ?? null;
  const suggestions: AiPipelinePlan["tasks"] = [];
  if (!openTasks.some((t) => /call|phone/i.test(t.title))) {
    suggestions.push({
      title: "Call or text the lead",
      description: "Confirm interest and preferred next step.",
      dueInDays: 1,
      priority: "high",
    });
  }
  if (!openTasks.some((t) => /showing|tour|visit/i.test(t.title))) {
    suggestions.push({
      title: "Schedule a showing or buyer consult",
      description: null,
      dueInDays: 3,
      priority: "normal",
    });
  }
  suggestions.push({
    title: "Log outcome in notes",
    description: "Capture budget, timeline, and objections.",
    dueInDays: 1,
    priority: "low",
  });
  return {
    summary:
      "OpenAI is not configured or failed; here is a standard realtor follow-up checklist for this lead.",
    recommendedStageSlug: slug,
    tasks: suggestions.slice(0, 5),
  };
}

export async function generateAiPipelinePlan(params: {
  lead: Record<string, unknown>;
  stages: PipelineStageRow[];
  openTasks: CrmTaskRow[];
  notesExtra?: string | null;
}): Promise<AiPipelinePlan> {
  const { lead, stages, openTasks, notesExtra } = params;
  const stageLines = stages.map((s) => `- ${s.slug}: ${s.name}`).join("\n");
  const taskLines = openTasks.map((t) => `- ${t.title} (${t.status}, ${t.priority})`).join("\n") || "(none)";

  const userPrompt = `You are planning next steps for a real estate CRM lead.

Pipeline stages (use recommendedStageSlug exactly from this list, or null if unsure):
${stageLines}

Lead record (JSON):
${JSON.stringify(lead, null, 2)}

Open tasks for this lead:
${taskLines}

${notesExtra ? `Agent added context:\n${notesExtra}\n` : ""}

Return 2–6 concrete tasks the agent should do next. Prefer specific, actionable titles. Use priority "urgent" sparingly. dueInDays is days from today (integer 0–30 or null if not time-bound).`;

  const openai = getOpenAI();
  if (!openai) {
    return fallbackPlan(stages, openTasks);
  }

  try {
    const response = await openai.responses.create({
      model: model(),
      instructions:
        "You output JSON only for a realtor deal pipeline assistant. Slugs must match the provided list when recommending a stage.",
      input: [{ role: "user", content: userPrompt }],
      text: {
        format: {
          type: "json_schema",
          name: "pipeline_plan",
          strict: true,
          schema: PLAN_SCHEMA as unknown as Record<string, unknown>,
        },
      },
    });

    const outputText = response.output_text?.trim();
    if (!outputText) throw new Error("empty output");
    const parsed = JSON.parse(outputText) as AiPipelinePlan;

    const allowed = new Set(stages.map((s) => s.slug));
    const slug = parsed.recommendedStageSlug;
    if (slug != null && slug !== "" && !allowed.has(slug)) {
      parsed.recommendedStageSlug = null;
    }

    if (!Array.isArray(parsed.tasks)) parsed.tasks = [];
    parsed.tasks = parsed.tasks
      .filter((t) => t && typeof t.title === "string" && t.title.trim())
      .slice(0, 8)
      .map((t) => ({
        title: t.title.trim(),
        description: t.description ?? null,
        dueInDays:
          typeof t.dueInDays === "number" && Number.isFinite(t.dueInDays)
            ? Math.max(0, Math.min(30, Math.round(t.dueInDays)))
            : null,
        priority: (["low", "normal", "high", "urgent"] as const).includes(t.priority as any)
          ? (t.priority as AiPipelinePlan["tasks"][0]["priority"])
          : "normal",
      }));

    return parsed;
  } catch {
    return fallbackPlan(stages, openTasks);
  }
}
