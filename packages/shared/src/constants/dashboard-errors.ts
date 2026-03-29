/**
 * Thrown when the user is signed in but has no `agents` row. Never use `auth.users.id`
 * as `agent_id` — CRM tables use `agents.id` (often bigint); a UUID causes Postgres 22P02.
 */
export const ERROR_DASHBOARD_NO_AGENT_ROW = "DASHBOARD_NO_AGENT_ROW" as const;
