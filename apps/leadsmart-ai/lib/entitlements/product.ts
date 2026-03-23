import type { ProductKey } from "./types";

/** LeadSmart CRM / agent workspace commercial product key (stored in product_entitlements.product). */
export const PRODUCT_LEADSMART_AGENT = "leadsmart_agent" satisfies ProductKey;

export type LeadsmartAgentProduct = typeof PRODUCT_LEADSMART_AGENT;
