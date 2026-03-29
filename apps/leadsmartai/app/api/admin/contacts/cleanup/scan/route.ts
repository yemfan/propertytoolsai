import { NextResponse } from "next/server";
import { requireRoleRoute } from "@/lib/auth/requireRole";
import { scanForDuplicateLeads } from "@/lib/contact-enrichment/service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const auth = await requireRoleRoute(["admin"], { strictUnauthorized: true });
    if (auth.ok === false) return auth.response;

    const body = (await req.json().catch(() => ({}))) as { limit?: number };
    const limit =
      typeof body.limit === "number" && body.limit > 0 && body.limit <= 5000
        ? body.limit
        : 2000;

    const candidates = await scanForDuplicateLeads(limit);
    return NextResponse.json({ success: true, candidates });
  } catch (e) {
    console.error("contact duplicate scan error:", e);
    return NextResponse.json({ success: false, error: "Failed to scan duplicates" }, { status: 500 });
  }
}
