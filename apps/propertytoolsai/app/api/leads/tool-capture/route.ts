import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { persistToolLead, type ToolLeadBody } from "@/lib/leads/persistToolLead";

export const runtime = "nodejs";

/**
 * Tool funnel lead capture — maps into existing CRM `leads` row shape.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ToolLeadBody;
    const authUser = await getUserFromRequest(req);
    const userId = authUser?.id ?? null;

    const result = await persistToolLead(body, { userId });
    if (result.ok === false) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status ?? 500 }
      );
    }

    return NextResponse.json({ ok: true, leadId: result.leadId });
  } catch (e: any) {
    console.error("POST /api/leads/tool-capture", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
