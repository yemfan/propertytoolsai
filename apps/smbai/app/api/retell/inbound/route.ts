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

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { loadReceptionistContext, buildReceptionistDynamicVariables } from "@/lib/receptionist-agent";

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

  const db = createServiceClient();
  let dynamic_variables: Record<string, string> = {};
  if (toNumber) {
    const { data: org } = await db.from("organizations").select("id").eq("twilio_number", toNumber).maybeSingle();
    if (org?.id) {
      const ctx = await loadReceptionistContext(db, org.id as string);
      dynamic_variables = buildReceptionistDynamicVariables(ctx);
    }
  }

  return NextResponse.json({ call_inbound: { dynamic_variables } });
}
