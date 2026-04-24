/**
 * Actions accepted by `POST /api/agent/consume-usage` (aligned with check-limit where applicable).
 * `invite_team` performs entitlement verification only — no daily counter in `entitlement_usage_daily`.
 */
export type AgentConsumeApiAction =
  | "create_cma"
  | "add_lead"
  | "add_contact"
  | "download_full_report"
  | "invite_team"
  | "ai_action";

/**
 * Client: record usage after a successful gated action (server re-checks limits before incrementing).
 */
export async function consumeAgentUsage(payload: { action: AgentConsumeApiAction }): Promise<void> {
  const res = await fetch("/api/agent/consume-usage", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = (await res.json()) as {
    success?: boolean;
    ok?: boolean;
    error?: string;
    result?: unknown;
  };

  if (!res.ok || json?.success === false || json?.ok === false) {
    throw new Error(json?.error || "Failed to consume usage");
  }
}
