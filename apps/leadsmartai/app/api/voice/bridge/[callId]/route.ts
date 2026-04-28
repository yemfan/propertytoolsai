import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildBridgeTwiml } from "@/lib/voice/clickToCall";

/**
 * Twilio fetches this URL once the agent's leg picks up. We return
 * TwiML that `<Dial>`s the contact, joining the two legs.
 *
 * Public — Twilio is the only legitimate caller, but signed
 * requests aren't trivially verifiable on a GET (no body to sign).
 * The callId in the path is opaque and short-lived, and the dial
 * target is bounded by what's stored in the row, so there's no
 * meaningful risk if a stranger fetches it.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ callId: string }> },
) {
  const { callId } = await params;

  const { data: row } = await supabaseAdmin
    .from("lead_calls")
    .select("to_phone, from_phone, metadata")
    .eq("id", callId)
    .maybeSingle();

  if (!row) {
    return xmlResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>Call not found. Goodbye.</Say><Hangup/></Response>`,
    );
  }

  const r = row as {
    to_phone: string;
    from_phone: string;
    metadata: Record<string, unknown> | null;
  };
  const whisper = (r.metadata?.whisper as string | null) ?? null;

  const twiml = buildBridgeTwiml({
    contactPhone: r.to_phone,
    callerId: r.from_phone,
    whisper,
  });

  return xmlResponse(twiml);
}

function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}
