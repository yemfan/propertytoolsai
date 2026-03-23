/**
 * Browser-only helpers for entitlements (fetch → `/api/agent/*`).
 * @see `checkAgentLimitClient.ts`, `consumeUsageClient.ts`
 */
export {
  checkAgentLimit,
  type AgentLimitApiAction,
} from "./checkAgentLimitClient";

export { consumeAgentUsage, type AgentConsumeApiAction } from "./consumeUsageClient";
