/**
 * Retell REST client (server-only).
 *
 * Wraps the Retell phone-number API so the guided-onboarding flow can buy or
 * import a number AND wire it to the shared agent + inbound webhook in a single
 * call — removing every manual Retell step. Never import this from client code:
 * it reads RETELL_API_KEY.
 *
 * Docs: https://docs.retellai.com/api-references/create-phone-number
 */

const RETELL_BASE = "https://api.retellai.com";

/** One inbound agent at full weight (single-agent setups). */
type InboundAgent = { agent_id: string; weight: number };

async function retellFetch<T>(path: string, init: { method: string; body?: unknown }): Promise<T> {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) throw new Error("RETELL_API_KEY is not set.");

  const res = await fetch(`${RETELL_BASE}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    // Surface Retell's own message when present; fall back to status text.
    let message = text || res.statusText;
    try {
      const parsed = JSON.parse(text);
      message = parsed?.error_message || parsed?.message || message;
    } catch {
      /* not JSON — use raw text */
    }
    throw new Error(`Retell ${path} failed (${res.status}): ${message}`);
  }

  return (text ? JSON.parse(text) : {}) as T;
}

type PhoneNumberResponse = {
  phone_number: string; // E.164
  phone_number_pretty?: string;
  inbound_agents?: InboundAgent[] | string[];
  inbound_webhook_url?: string | null;
  area_code?: number;
  nickname?: string | null;
};

/** Buy a new US number and bind the agent + inbound webhook at creation. */
export async function createRetellNumber(input: {
  areaCode: number;
  tollFree?: boolean;
  nickname?: string;
  agentId: string;
  inboundWebhookUrl: string;
}): Promise<{ phoneNumber: string }> {
  const data = await retellFetch<PhoneNumberResponse>("/create-phone-number", {
    method: "POST",
    body: {
      area_code: input.areaCode,
      country_code: "US",
      number_provider: "twilio",
      toll_free: input.tollFree ?? false,
      nickname: input.nickname,
      inbound_agents: [{ agent_id: input.agentId, weight: 1 }],
      inbound_webhook_url: input.inboundWebhookUrl,
    },
  });
  return { phoneNumber: data.phone_number };
}

/** Import an existing number via its SIP trunk, binding agent + inbound webhook. */
export async function importRetellNumber(input: {
  phoneNumber: string; // E.164
  terminationUri: string;
  sipUser?: string;
  sipPass?: string;
  nickname?: string;
  agentId: string;
  inboundWebhookUrl: string;
}): Promise<{ phoneNumber: string }> {
  const data = await retellFetch<PhoneNumberResponse>("/import-phone-number", {
    method: "POST",
    body: {
      phone_number: input.phoneNumber,
      termination_uri: input.terminationUri,
      sip_trunk_auth_username: input.sipUser || undefined,
      sip_trunk_auth_password: input.sipPass || undefined,
      nickname: input.nickname,
      inbound_agents: [{ agent_id: input.agentId, weight: 1 }],
      inbound_webhook_url: input.inboundWebhookUrl,
    },
  });
  return { phoneNumber: data.phone_number };
}

/** Read a number's current wiring (for the "Verify wiring" check). */
export async function getRetellNumber(phoneNumber: string): Promise<{
  found: boolean;
  inboundWebhookUrl: string | null;
  agentIds: string[];
}> {
  try {
    const data = await retellFetch<PhoneNumberResponse>(
      `/get-phone-number/${encodeURIComponent(phoneNumber)}`,
      { method: "GET" }
    );
    const agents = data.inbound_agents ?? [];
    const agentIds = agents.map((a) => (typeof a === "string" ? a : a.agent_id));
    return { found: true, inboundWebhookUrl: data.inbound_webhook_url ?? null, agentIds };
  } catch {
    return { found: false, inboundWebhookUrl: null, agentIds: [] };
  }
}

/**
 * Place an outbound call from a Retell-registered number, driven by an agent.
 * Dynamic variables are passed at creation (no inbound webhook), so the agent
 * gets the lead's context + outbound prompt for this specific call.
 * Docs: https://docs.retellai.com/api-references/create-phone-call
 */
export async function createPhoneCall(input: {
  fromNumber: string; // E.164 — must be registered in Retell
  toNumber: string; // E.164
  agentId: string;
  dynamicVariables: Record<string, string>;
  metadata?: Record<string, unknown>;
}): Promise<{ callId: string }> {
  const data = await retellFetch<{ call_id: string }>("/v2/create-phone-call", {
    method: "POST",
    body: {
      from_number: input.fromNumber,
      to_number: input.toNumber,
      override_agent_id: input.agentId,
      retell_llm_dynamic_variables: input.dynamicVariables,
      metadata: input.metadata,
    },
  });
  return { callId: data.call_id };
}
