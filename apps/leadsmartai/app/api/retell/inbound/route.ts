import { NextRequest, NextResponse } from "next/server";
import { resolveVoiceAgentId } from "@/lib/ai-call/lead-resolution";
import { loadReceptionistContext } from "@/lib/voice-agent/context";
import { buildReceptionistDynamicVariables } from "@repo/voice";

/**
 * Retell inbound-call webhook (LeadSmart) — POST /api/retell/inbound
 *
 * Additive, opt-in: a parallel Retell-based receptionist that reuses the shared
 * @repo/voice prompt core. It resolves the agent from the dialed number using
 * the existing VOICE_INBOUND_AGENT_MAP logic, then hands Retell the per-agent
 * dynamic variables built by the shared builder. LeadSmart's existing
 * Twilio/OpenAI-Realtime voice (/api/twilio/voice/inbound) is untouched — point
 * a number's Retell inbound webhook here to use the Retell receptionist instead.
 *
 * Must be fast (Retell's timeout is ~10s) and return string→string values only.
 * Retell can't sign this webhook, so gate with ?k=<RETELL_FUNCTION_SECRET>.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RETELL_FUNCTION_SECRET;
  if (secret && req.nextUrl.searchParams.get("k") !== secret) {
    return NextResponse.json({ call_inbound: { dynamic_variables: {} } }, { status: 401 });
  }

  let toNumber = "";
  try {
    const body = await req.json();
    toNumber = String(body?.call_inbound?.to_number ?? "");
  } catch {
    /* malformed body — fall through to empty vars */
  }

  let dynamic_variables: Record<string, string> = {};
  const agentId = await resolveVoiceAgentId(toNumber);
  if (agentId) {
    const ctx = await loadReceptionistContext(agentId);
    dynamic_variables = buildReceptionistDynamicVariables(ctx);
  }

  return NextResponse.json({ call_inbound: { dynamic_variables } });
}
