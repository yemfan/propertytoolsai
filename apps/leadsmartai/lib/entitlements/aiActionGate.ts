"use client";

import { emitLeadsmartUpgradePrompt } from "@/lib/funnel/emitUpgradePrompt";

/**
 * Client-side gate detector for AI-action endpoints.
 *
 * Every AI-action route (sms/draft, generate-script, transactions/review,
 * growth/opportunities, deal-assistant/analyze, mobile reply routes)
 * uses the same `canUseAiAction` check and returns HTTP 402 with `code`
 * = `"no_agent_entitlement"` (no plan covers AI yet) or
 * `"ai_usage_limit_reached"` (this period's cap is exhausted).
 *
 * This helper centralizes that detection so client code:
 *   - doesn't have to know the magic strings
 *   - automatically opens the workspace-level upgrade modal so the
 *     agent has a clear next step instead of a dead-end error
 *   - returns a structured `gated` flag the caller can use to drive
 *     its own inline state (e.g. disable the "Generate" button, swap
 *     a red error for an amber upgrade banner)
 *
 * Use after `await fetch(...)` returns:
 *
 *     const gate = detectAiActionGate(res.status, json);
 *     if (gate) { setGate(gate); return; }
 *
 * `emit` defaults to true so the global upgrade modal opens
 * automatically. Pass `emit: false` if the caller wants to render an
 * inline banner instead and only fire the modal on user click.
 */
export type AiActionGateReason =
  | "no_agent_entitlement"
  | "ai_usage_limit_reached";

export type AiActionGate = {
  reason: AiActionGateReason;
};

export function detectAiActionGate(
  status: number,
  body: unknown,
  opts?: { emit?: boolean },
): AiActionGate | null {
  if (status !== 402) return null;
  const code = isObj(body) && typeof body.code === "string" ? body.code : null;
  if (code !== "no_agent_entitlement" && code !== "ai_usage_limit_reached") {
    return null;
  }
  if (opts?.emit !== false) {
    emitLeadsmartUpgradePrompt(code);
  }
  return { reason: code };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v != null;
}
