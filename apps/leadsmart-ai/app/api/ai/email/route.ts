import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { handleAiEmail } from "@/lib/ai/handlers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Parameters<typeof handleAiEmail>[1];
    const result = await handleAiEmail(user.id, body);

    return NextResponse.json({
      ok: true,
      text: result.text,
      cached: result.cached,
      tokens_used: result.tokensUsed,
    });
  } catch (e: any) {
    const status = e?.status ?? (e?.code === "RATE_LIMIT" ? 429 : 500);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: Number.isFinite(status) ? status : 500 }
    );
  }
}
