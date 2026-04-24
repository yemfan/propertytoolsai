import type { AccessResult } from "@/lib/entitlements/types";

/** Body for `POST /api/agent/check-limit` (uses `accessResult` checks on the server). */
export type AgentLimitApiAction =
  | "create_cma"
  | "add_lead"
  | "add_contact"
  | "download_full_report"
  | "invite_team"
  | "ai_action";

/**
 * Client: call the agent check-limit API and return `AccessResult`.
 * Server-side code should use `checkAgentLimit` in `checkLimit.ts` (different signature) instead.
 */
export async function checkAgentLimit(payload: { action: AgentLimitApiAction }): Promise<AccessResult> {
  const res = await fetch("/api/agent/check-limit", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = (await res.json()) as {
    success?: boolean;
    ok?: boolean;
    error?: string;
    result?: AccessResult;
  };

  if (!res.ok || json?.success === false || json?.ok === false) {
    throw new Error(json?.error || "Failed to check limit");
  }

  if (json.result == null) {
    throw new Error("Failed to check limit");
  }

  return json.result;
}
