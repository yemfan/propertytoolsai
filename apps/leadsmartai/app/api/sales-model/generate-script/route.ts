import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { getOpenAIConfig } from "@/lib/ai/openaiClient";
import { canUseAiAction } from "@/lib/entitlements/accessResult";
import { consumeAiToken } from "@/lib/entitlements/consumeAiToken";
import { getSelectedSalesModelServer } from "@/lib/sales-model-server";
import {
  DEFAULT_SALES_MODEL,
  getSalesModel,
  isSalesModelId,
  SCRIPT_KINDS,
  type ScriptKind,
} from "@/lib/sales-models";

export const runtime = "nodejs";

/**
 * POST /api/sales-model/generate-script
 *
 * Generates a sales script for the agent using their currently
 * selected sales model + the situation they describe. The model
 * supplies the *tone* (calm advisor / direct closer / energetic
 * influencer / neutral custom) and the kind supplies the *structure*
 * (DM reply, follow-up, objection handling, appointment setting,
 * consultation opening).
 *
 * Wire matches the rest of the dashboard AI surfaces:
 *   - getCurrentAgentContext for auth
 *   - canUseAiAction → consumeAiToken for quota gating
 *   - direct fetch to OpenAI chat-completions (gpt-4o-mini default)
 *   - non-streaming JSON response
 *
 * Request body:
 *   { kind: ScriptKind, situation: string, salesModel?: SalesModelId }
 *
 * Response:
 *   { ok: true, script: string, source: "ai" | "fallback" }
 *   { ok: false, error: string, code?: string }
 *
 * `salesModel` in the body is an override — if the client passes one
 * (e.g. the user just switched in another tab and the API row hasn't
 * caught up) we trust it. Otherwise we read the persisted selection.
 */

const VALID_KINDS = new Set<ScriptKind>(SCRIPT_KINDS.map((k) => k.value));

export async function POST(req: Request) {
  let userId: string;
  try {
    const ctx = await getCurrentAgentContext();
    userId = ctx.userId;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    return NextResponse.json(
      { ok: false, error: msg, code: "unauthorized" },
      { status: msg === "Not authenticated" ? 401 : 500 },
    );
  }

  // Parse + validate body. `kind` is OPTIONAL — when absent (the
  // common case post-UI-cleanup) the model auto-classifies what
  // kind of message the situation calls for and returns its pick
  // alongside the generated script. We still accept an explicit
  // override so future "force this format" UX (e.g. a "regenerate
  // as objection handling" button) doesn't need a new endpoint.
  const body = (await req.json().catch(() => ({}))) as {
    kind?: unknown;
    situation?: unknown;
    salesModel?: unknown;
  };
  const explicitKind: ScriptKind | null =
    typeof body.kind === "string" && VALID_KINDS.has(body.kind as ScriptKind)
      ? (body.kind as ScriptKind)
      : null;
  if (
    body.kind !== undefined &&
    body.kind !== null &&
    body.kind !== "" &&
    explicitKind === null
  ) {
    // Pass through the case where the caller sent something for
    // `kind` but it's not a recognized value — surface as 400 so we
    // don't silently mask a typo.
    return NextResponse.json(
      {
        ok: false,
        error: `kind must be one of: ${Array.from(VALID_KINDS).join(", ")}`,
        code: "invalid_kind",
      },
      { status: 400 },
    );
  }
  const situation = typeof body.situation === "string" ? body.situation.trim() : "";
  if (!situation) {
    return NextResponse.json(
      { ok: false, error: "situation is required.", code: "missing_situation" },
      { status: 400 },
    );
  }
  if (situation.length > 4000) {
    // Cap at 4k chars — long enough for a detailed briefing, short
    // enough that we don't blow context on accidental paste-bombs.
    return NextResponse.json(
      { ok: false, error: "situation is too long (max 4000 chars).", code: "situation_too_long" },
      { status: 400 },
    );
  }

  // Resolve the model: explicit override → persisted selection → default.
  let modelIdValue = isSalesModelId(body.salesModel) ? body.salesModel : null;
  if (!modelIdValue) {
    modelIdValue = await getSelectedSalesModelServer(userId);
  }
  const modelId = modelIdValue ?? DEFAULT_SALES_MODEL;
  const model = getSalesModel(modelId);

  // Quota gate. Mirror the existing AI surface pattern: peek first,
  // consume on success. If the agent has no quota left, we surface
  // a clear 402 with the limit so the client can route to billing.
  const access = await canUseAiAction(userId);
  if (!access.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error:
          access.reason === "no_agent_entitlement"
            ? "Your account is not provisioned for AI actions yet."
            : "You've reached your AI action limit for this period.",
        code: access.reason ?? "ai_action_blocked",
        limit: access.limit ?? null,
        currentUsage: access.currentUsage ?? null,
      },
      { status: 402 },
    );
  }

  // Build the prompts. System carries the agent's identity + tone
  // and either (a) per-kind structural rules when the caller forced
  // a kind, or (b) a "decide which kind fits and produce it"
  // instruction set when no kind was given. User carries the
  // briefing they typed.
  const systemPrompt = buildSystemPrompt(model.id, explicitKind);
  const userPrompt = buildUserPrompt(situation, explicitKind);

  // Call OpenAI. If no key is configured (dev / preview without
  // secrets) we return a clear 503 so the client can fall back to
  // the local template. We DO NOT charge a token in that case.
  const { apiKey, model: openaiModel } = getOpenAIConfig();
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "AI is not configured on this environment.",
        code: "ai_unconfigured",
      },
      { status: 503 },
    );
  }

  let scriptText = "";
  let detectedKind: ScriptKind | null = null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openaiModel,
        temperature: 0.7,
        max_tokens: 700,
        // Force JSON so we can pull `detectedKind` out alongside the
        // script. response_format is supported on gpt-4o-mini and
        // newer; for older models the prompt itself instructs JSON.
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const json = (await res.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    } | null;

    if (!res.ok) {
      const upstreamMsg = json?.error?.message ?? `OpenAI ${res.status}`;
      console.error("[generate-script] OpenAI error:", res.status, upstreamMsg);
      return NextResponse.json(
        { ok: false, error: "AI service error. Try again.", code: "openai_error" },
        { status: 502 },
      );
    }

    const raw = String(json?.choices?.[0]?.message?.content ?? "").trim();
    const parsed = parseScriptJson(raw);
    if (parsed) {
      scriptText = parsed.script.trim();
      // Trust the model's classification only if it's a known kind.
      detectedKind =
        parsed.detectedKind && VALID_KINDS.has(parsed.detectedKind as ScriptKind)
          ? (parsed.detectedKind as ScriptKind)
          : null;
    } else {
      // Model didn't return parseable JSON. The string is still
      // probably the script — better to ship something than fail
      // hard on a parse-shape miss. detectedKind stays null in that
      // case so the client knows it's "AI-generated, no auto-tag".
      scriptText = raw;
    }
  } catch (e) {
    console.error("[generate-script] fetch failed:", e);
    return NextResponse.json(
      { ok: false, error: "Could not reach AI service.", code: "openai_unreachable" },
      { status: 502 },
    );
  }

  if (!scriptText) {
    return NextResponse.json(
      { ok: false, error: "AI returned an empty response.", code: "empty_response" },
      { status: 502 },
    );
  }

  // Charge one AI token. Best-effort — if metering fails we still
  // return the script (the user already got the value). Logged so
  // we can reconcile.
  consumeAiToken(userId).catch((err) => {
    console.warn(
      "[generate-script] consumeAiToken failed:",
      err instanceof Error ? err.message : err,
    );
  });

  return NextResponse.json({
    ok: true,
    script: scriptText,
    detectedKind,
    source: "ai" as const,
  });
}

// ── Prompt builders ────────────────────────────────────────────────

function buildSystemPrompt(
  modelId: ReturnType<typeof getSalesModel>["id"],
  explicitKind: ScriptKind | null,
): string {
  const m = getSalesModel(modelId);

  // When the caller forced a kind, we lock the structure to it.
  // When they didn't (the common case), we hand the model the full
  // catalog and ask it to pick — and to tell us what it picked.
  // Many real situations blend kinds (objection raised inside an
  // appointment-setting context); the model is better-positioned
  // than a dropdown to call that.
  const kindCatalog = SCRIPT_KINDS.map(
    (k) => `- "${k.value}" — ${k.label}: ${STRUCTURE_BY_KIND[k.value].split("\n")[0]}`,
  ).join("\n");

  const kindSection = explicitKind
    ? `Output type (caller-forced): ${SCRIPT_KINDS.find((k) => k.value === explicitKind)?.label ?? explicitKind}.

Structure for this output type:
${STRUCTURE_BY_KIND[explicitKind]}`
    : `Output type: decide based on the situation.

Available types and what they're for:
${kindCatalog}

How to choose:
- Read the situation. Identify the agent's actual goal.
- Pick the SINGLE type that best matches. If the situation blends
  two (e.g. an objection raised while trying to set an appointment),
  pick the one that resolves the agent's NEXT MOVE.
- Use the structure for the chosen type from the rules below.

Structures:
${SCRIPT_KINDS.map((k) => `### ${k.label} ("${k.value}")\n${STRUCTURE_BY_KIND[k.value]}`).join("\n\n")}`;

  return `You are an AI assistant helping a real-estate agent write the next message to a lead.

The agent is operating in their sales-model identity:
- Identity: ${m.identityTitle.replace(/^You are operating as (a |an )?/, "")}.
- Philosophy: ${m.philosophy}
- Communication style: ${m.tone}.
- Typical lead types: ${m.leadTypes.join(", ")}.

Output rules — match the tone above EXACTLY. Tone is the most important constraint.

${kindSection}

General rules:
- Write the message ready-to-send. No "[BRACKETS]" placeholders unless a fact is genuinely unknown.
- If the agent's situation provides the lead's name, use it. Otherwise no greeting placeholder.
- Length: 80–220 words unless the format demands shorter (e.g. SMS-style DMs ~60 words).
- Plain text only inside the "script" field. No markdown, no bullet lists unless the message is naturally a list.
- Do not invent facts about the property, comps, or numbers. If a fact is needed and not provided, write the sentence around its absence ("once we line up the comps") rather than fabricating.
- Do not break character into the wrong tone. ${m.id === "influencer" ? "Don't go corporate." : m.id === "closer" ? "Don't get fluffy or apologetic." : m.id === "advisor" ? "Don't get pushy or overly casual." : "Default to a clean professional voice the agent can adjust."}

OUTPUT FORMAT — return strict JSON only, no markdown fence, with exactly these two fields:
{
  "detectedKind": "<one of: ${SCRIPT_KINDS.map((k) => k.value).join(" | ")}>",
  "script": "<the message ready to send>"
}

The "script" field is plain text. Newlines are allowed. Do not include any keys other than detectedKind and script.`;
}

function buildUserPrompt(situation: string, explicitKind: ScriptKind | null): string {
  if (explicitKind) {
    const label = SCRIPT_KINDS.find((k) => k.value === explicitKind)?.label ?? explicitKind;
    return `Generate a ${label} for the following situation. Use the agent's voice and the format rules from the system prompt.

Situation:
${situation}

Return JSON: { "detectedKind": "${explicitKind}", "script": "..." }.`;
  }
  return `The agent has described a situation. Decide which type of message best fits the agent's next move, then write it in their voice. Use the format rules from the system prompt.

Situation:
${situation}

Return JSON: { "detectedKind": "...", "script": "..." }.`;
}

/**
 * Tolerant JSON parser for the model's reply. Handles:
 *   - Markdown ```json ... ``` fences (some older models wrap)
 *   - Leading/trailing whitespace
 *   - Extra fields beyond detectedKind/script
 *
 * Returns null when the payload is unparseable or missing the script
 * field — caller falls back to using the raw content as plain text.
 */
function parseScriptJson(raw: string): { script: string; detectedKind: string | null } | null {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  try {
    const j = JSON.parse(t) as { script?: unknown; detectedKind?: unknown };
    const script = typeof j.script === "string" ? j.script : "";
    if (!script.trim()) return null;
    const detectedKind = typeof j.detectedKind === "string" ? j.detectedKind : null;
    return { script, detectedKind };
  } catch {
    return null;
  }
}

const STRUCTURE_BY_KIND: Record<ScriptKind, string> = {
  dm_reply: `1. Acknowledge the lead's specific question or signal in 1 line.
2. Add one concrete value-add (insight, info, or perspective they wouldn't already have).
3. End with one clear, low-friction next step (a question, a time offer, or "want me to send X").`,
  follow_up: `1. Open with light context referencing the prior conversation (use facts from the situation, never invented).
2. Offer a specific reason this follow-up is happening NOW — a market shift, a new listing, a deadline.
3. Ask one question that lets the lead easily say yes/no/later — don't demand a meeting unless it fits the situation.`,
  objection_handling: `1. Acknowledge the objection sincerely — name it back to the lead so they feel heard.
2. Reframe with one specific angle: data they may not have, a different lens, or a question that surfaces their real concern.
3. Propose a concrete next step that lets the lead validate the reframe (a side-by-side, a tour, a 10-min call) — not a pressure close.`,
  appointment_setting: `1. Reference the situation specifically so the lead sees this isn't a generic ask.
2. Make the appointment value clear in 1 line — what they leave with, not what you do.
3. Offer two specific time options OR a clear way to pick — don't ask "when works for you" cold.`,
  consultation_opening: `1. Thank the lead for the time and set a tight agenda for the call (3 sections, length).
2. Start with a discovery question tied to the situation.
3. Signal the path: discovery → recommendation → agreed next step. End with the first discovery question.`,
};
