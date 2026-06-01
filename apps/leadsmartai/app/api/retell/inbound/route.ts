import { NextRequest, NextResponse } from "next/server";
import { resolveVoiceAgentId } from "@/lib/ai-call/lead-resolution";
import { loadReceptionistContext } from "@/lib/voice-agent/context";
import { buildReceptionistDynamicVariables } from "@repo/voice";

/**
 * Known LeadSmart receptionist numbers -> agent id. Committed fallback so the
 * inbound webhook resolves the right account without per-number env config;
 * resolveVoiceAgentId (VOICE_INBOUND_AGENT_MAP / default env) still handles any
 * number not listed here. Extend this as receptionist numbers are added.
 */
const NUMBER_AGENT_OVERRIDES: Record<string, string> = {
  "+18778017240": "22", // Michael Ye Realty — Lucy
};

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
  const agentId = NUMBER_AGENT_OVERRIDES[toNumber] || (await resolveVoiceAgentId(toNumber));
  if (agentId) {
    try {
      const ctx = await loadReceptionistContext(agentId);
      if (ctx) dynamic_variables = buildReceptionistDynamicVariables(ctx);
    } catch (err) {
      // Never 500 on Retell — fall back to empty variables.
      console.error("retell/inbound: failed to build receptionist context", err);
    }
  }

  return NextResponse.json({ call_inbound: { dynamic_variables } });
}
