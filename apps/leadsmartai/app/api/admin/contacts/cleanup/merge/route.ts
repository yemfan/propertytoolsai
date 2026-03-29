import { NextResponse } from "next/server";
import { requireRoleRoute } from "@/lib/auth/requireRole";
import { mergeDuplicateLeadPair } from "@/lib/contact-enrichment/service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const auth = await requireRoleRoute(["admin"], { strictUnauthorized: true });
    if (auth.ok === false) return auth.response;

    const body = (await req.json().catch(() => ({}))) as {
      primaryLeadId?: string;
      duplicateLeadId?: string;
    };
    const primaryLeadId = String(body.primaryLeadId ?? "").trim();
    const duplicateLeadId = String(body.duplicateLeadId ?? "").trim();
    if (!primaryLeadId || !duplicateLeadId) {
      return NextResponse.json({ success: false, error: "Missing lead ids" }, { status: 400 });
    }

    const merged = await mergeDuplicateLeadPair(primaryLeadId, duplicateLeadId);
    return NextResponse.json({ success: true, merged });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to merge leads";
    console.error("contact merge error:", e);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
