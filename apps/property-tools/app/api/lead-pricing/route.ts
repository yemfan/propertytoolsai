import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { computeLeadPricing } from "@/lib/leadPricingEngine";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const url = new URL(req.url);
    const opportunityId = String(url.searchParams.get("opportunityId") ?? "").trim();
    const leadId = String(url.searchParams.get("leadId") ?? "").trim();
    if (!opportunityId && !leadId) {
      return NextResponse.json(
        { ok: false, error: "opportunityId or leadId is required" },
        { status: 400 }
      );
    }

    const result = await computeLeadPricing({
      opportunityId: opportunityId || undefined,
      leadId: leadId || undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
