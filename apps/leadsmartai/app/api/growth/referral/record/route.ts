import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { recordReferralEventSafe } from "@/lib/growth/referralDb";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      code?: string;
      event_type?: string;
      page_path?: string;
      metadata?: Record<string, unknown>;
    };
    const code = String(body.code ?? "");
    const eventType = String(body.event_type ?? "view") as
      | "view"
      | "click"
      | "signup"
      | "conversion"
      | "share";
    if (!["view", "click", "signup", "conversion", "share"].includes(eventType)) {
      return NextResponse.json({ ok: false, error: "bad event_type" }, { status: 400 });
    }

    const user = await getUserFromRequest(req);

    const r = await recordReferralEventSafe({
      code,
      eventType,
      authUserId: user?.id ?? null,
      pagePath: body.page_path ?? null,
      metadata: body.metadata,
    });

    if (!r.ok && r.reason === "unknown_code") {
      return NextResponse.json({ ok: false, error: "invalid_code" }, { status: 404 });
    }
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: r.reason }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "error" }, { status: 500 });
  }
}
