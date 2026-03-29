export { PRODUCT_LEADSMART_AGENT } from "./product";
export * from "./types";
export * from "./planCatalog";

export * from "./getEntitlements";
export * from "./usage";
export * from "./limits";
export * from "./agentAccess";
export * from "./checkLimit";

/** Client `POST /api/agent/check-limit` — `checkAgentLimit({ action })` (distinct from server `checkAgentLimit` in `checkLimit.ts`) */
export * as agentLimitApi from "./checkAgentLimitClient";

/** Preferred client import path — re-exports `checkAgentLimit` from `checkAgentLimitClient` */
export * as clientCheck from "./clientCheck";

/** Service-role entitlement queries — `entitlementsAdmin.getUserEntitlements`, `getAgentEntitlement` */
export * as entitlementsAdmin from "./adminEntitlements";

/** Service-role daily usage — `entitlementsAdminUsage.ensureDailyUsageRow`, `getTodayUsage`, `incrementUsage` */
export * as entitlementsAdminUsage from "./adminUsage";

/** `AccessResult` checks by `userId` only — `accessResult.canCreateCma`, `hasAgentWorkspaceAccess`, … */
export * as accessResult from "./accessResult";
