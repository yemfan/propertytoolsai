import "server-only";

import {
  buildOutboundDynamicVariables,
  createPhoneCall,
  type ReceptionistContext,
} from "@repo/voice";
import { logOutboundCall } from "@/lib/missed-call/service";

/** Receptionist number + agent that place LeadSmart outbound AI calls. Single
 *  receptionist for now; when multiple agents/numbers exist this resolves from
 *  the caller's config row instead of these constants. */
export const OUTBOUND_FROM_NUMBER = "+18778017240";
export const OUTBOUND_RETELL_AGENT_ID = "agent_7e51ed0664a3716ecaa6a183d4"; // Lucy

/**
 * Place one outbound AI call (Lucy dials the lead, discloses she's an AI, and
 * follows up) and log it to `call_logs` so it shows in the AI Assistant activity
 * feed. Shared by the single-call and bulk-call routes so both behave identically.
 */
export async function placeOutboundCall(args: {
  ctx: ReceptionistContext;
  agentId: string;
  leadName: string;
  toNumberE164: string;
}): Promise<{ callId: string }> {
  const dynamicVariables = buildOutboundDynamicVariables(args.ctx, {
    leadName: args.leadName,
    purpose: "follow_up",
  });

  const { callId } = await createPhoneCall({
    fromNumber: OUTBOUND_FROM_NUMBER,
    toNumber: args.toNumberE164,
    agentId: OUTBOUND_RETELL_AGENT_ID,
    dynamicVariables,
    metadata: { source: "leadsmart-outbound", leadName: args.leadName, agentId: args.agentId },
  });

  // Best-effort log — never fail the placed call on a logging error.
  await logOutboundCall({
    agentId: args.agentId,
    toPhone: args.toNumberE164,
    fromPhone: OUTBOUND_FROM_NUMBER,
    providerCallId: callId,
    leadName: args.leadName || null,
  });

  return { callId };
}
