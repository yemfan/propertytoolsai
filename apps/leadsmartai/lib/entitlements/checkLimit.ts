import type { SupabaseClient } from "@supabase/supabase-js";
import { PRODUCT_LEADSMART_AGENT } from "./product";
import type { LimitMetric } from "./types";
import {
  canAddContact,
  canAddLead,
  canCreateCma,
  canDownloadFullReport,
  canInviteTeam,
  canUseAiAction,
} from "./limits";

export async function checkAgentLimit(
  supabase: SupabaseClient,
  userId: string,
  metric: LimitMetric
) {
  switch (metric) {
    case "cma_report":
      return canCreateCma(supabase, userId);
    case "lead":
      return canAddLead(supabase, userId);
    case "contact":
      return canAddContact(supabase, userId);
    case "report_download":
      return canDownloadFullReport(supabase, userId);
    case "team_invite":
      return canInviteTeam(supabase, userId);
    case "ai_action":
      return canUseAiAction(supabase, userId);
    default:
      return {
        allowed: false,
        reason: "Unknown limit metric.",
        reasonCode: null,
        plan: null,
        product: PRODUCT_LEADSMART_AGENT,
        currentUsage: {},
        limit: null,
      };
  }
}
