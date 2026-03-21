import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseServer } from "@/lib/supabaseServer";
import { getMarketplaceSessionId } from "@/lib/marketplaceSessionId";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      tool_name?: string;
      property_address?: string;
      action?: string;
      estimated_value?: number | null;
    };

    const toolName = String(body.tool_name ?? "").trim();
    const propertyAddress = String(body.property_address ?? "").trim();
    const action = String(body.action ?? "view").trim();
    const estimatedValueRaw = body.estimated_value;

    if (!toolName || !propertyAddress) {
      return NextResponse.json(
        { ok: false, error: "tool_name and property_address are required" },
        { status: 400 }
      );
    }

    const user = await getUserFromRequest(req);
    const userId = user?.id ?? null;

    const sessionId = getMarketplaceSessionId(req);

    const p_estimated_value =
      estimatedValueRaw == null || !Number.isFinite(Number(estimatedValueRaw))
        ? null
        : Number(estimatedValueRaw);

    const { data, error } = await supabaseServer.rpc(
      "log_tool_usage_and_update_opportunity",
      {
        p_user_id: userId,
        p_session_id: sessionId,
        p_tool_name: toolName,
        p_property_address: propertyAddress,
        p_action: action,
        p_estimated_value,
      } as any
    );

    if (error) {
      return NextResponse.json({ ok: false, error: error.message ?? "DB error" }, { status: 500 });
    }

    const ok = (data as any)?.ok === true;
    if (!ok) {
      return NextResponse.json({ ok: false, error: (data as any)?.message ?? "Failed to log usage" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, result: data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

