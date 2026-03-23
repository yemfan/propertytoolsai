import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { buildEntitlementSnapshot } from "@/lib/entitlements/usage";
import { PLAN_CATALOG } from "@/lib/entitlements/planCatalog";
import type { AgentPlanId } from "@/lib/entitlements/types";

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = supabaseServerClient();
    const snapshot = await buildEntitlementSnapshot(supabase, user.id);
    const planId = snapshot.entitlement?.plan as AgentPlanId | undefined;
    const catalog =
      planId && planId in PLAN_CATALOG ? PLAN_CATALOG[planId as AgentPlanId] : null;

    return NextResponse.json({
      ok: true,
      entitlement: snapshot.entitlement,
      usageToday: snapshot.usageToday,
      counts: snapshot.counts,
      planCatalog: catalog,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
