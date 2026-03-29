import { NextResponse } from "next/server";
import { requireRoleRoute } from "@/lib/auth/requireRole";
import { runLeadEnrichment } from "@/lib/contact-enrichment/service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const auth = await requireRoleRoute(["admin"], { strictUnauthorized: true });
    if (auth.ok === false) return auth.response;

    const body = (await req.json().catch(() => ({}))) as { limit?: number };
    const limit =
      typeof body.limit === "number" && body.limit > 0 && body.limit <= 500 ? body.limit : 200;

    const results = await runLeadEnrichment(limit);
    return NextResponse.json({ success: true, count: results.length, results });
  } catch (e) {
    console.error("contact enrichment error:", e);
    return NextResponse.json({ success: false, error: "Failed to run enrichment" }, { status: 500 });
  }
}
