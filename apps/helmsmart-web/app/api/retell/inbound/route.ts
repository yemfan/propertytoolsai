/**
 * Retell inbound-call webhook — POST /api/retell/inbound
 *
 * Fires when a call arrives, BEFORE the conversation starts. We map the dialed
 * number (to_number) to an org and hand back that org's receptionist brain as
 * Retell dynamic variables, so ONE shared Retell agent serves every tenant.
 *
 * Must be fast (Retell's timeout is ~10s) and return string→string values only.
 * Retell can't sign this webhook, so we gate with ?k=<RETELL_FUNCTION_SECRET>.
 * Set each Retell number's inbound_webhook_url to:
 *   https://<app>/api/retell/inbound?k=<RETELL_FUNCTION_SECRET>
 */

import { NextRequest, NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { loadReceptionistContext, buildReceptionistDynamicVariables, findOrgIdByNumber } from "@/lib/receptionist-agent";
import { matchOrCreateClient } from "@/lib/booking";
import { normalizePhoneE164 } from "@/lib/phone";

/** Format a caller's E.164 number into a spoken-friendly US form, e.g.
 *  "+16267557917" -> "(626) 755-7917". Falls back to the raw input. */
function formatCallerNumber(e164: string): string {
  const d = (e164 || "").replace(/\D/g, "").slice(-10);
  if (d.length !== 10) return e164 || "";
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export async function POST(req: NextRequest) {
  const secret = process.env.RETELL_FUNCTION_SECRET;
  if (secret && req.nextUrl.searchParams.get("k") !== secret) {
    return NextResponse.json({ call_inbound: { dynamic_variables: {} } }, { status: 401 });
  }

  let toNumber = "";
  let fromNumber = "";
  try {
    const body = await req.json();
    toNumber = String(body?.call_inbound?.to_number ?? "");
    fromNumber = String(body?.call_inbound?.from_number ?? "");
  } catch {
    /* malformed body — fall through to empty vars */
  }

  const db = await createServiceClient();
  let dynamic_variables: Record<string, string> = {};
  // findOrgIdByNumber tolerates phone-format differences (+1 prefix, spacing).
  const orgId = await findOrgIdByNumber(db, toNumber);
  if (orgId) {
    const ctx = await loadReceptionistContext(db, orgId);

    // Give the receptionist the caller's own number so it can confirm it as the
    // callback number (and catch a mistyped/different number the caller dictates).
    const caller = normalizePhoneE164(fromNumber);
    if (caller.ok) ctx.callerNumber = formatCallerNumber(caller.value);

    dynamic_variables = buildReceptionistDynamicVariables(ctx);

    // Capture the caller as a contact: match the caller ID to an existing client,
    // or create a lead if it's new — so every inbound caller becomes a follow-up-
    // able contact (and appears in outbound "Call all"). Runs in the background so
    // it never slows Retell's inbound response (which must return within ~10s).
    if (caller.ok) {
      after(() => matchOrCreateClient(orgId, caller.value));
    }
  }

  return NextResponse.json({ call_inbound: { dynamic_variables } });
}
