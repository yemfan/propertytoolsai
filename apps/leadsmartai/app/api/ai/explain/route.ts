import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { handleAiExplain, type ExplainMode } from "@/lib/ai/handlers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      mode?: ExplainMode;
      lead?: unknown;
      cma?: unknown;
      notification?: unknown;
      personalization?: unknown;
    };

    if (!body.mode || !["lead", "cma", "notification"].includes(body.mode)) {
      return NextResponse.json(
        { ok: false, error: "mode is required: lead | cma | notification" },
        { status: 400 }
      );
    }

    const result = await handleAiExplain(user.id, body as any);

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
