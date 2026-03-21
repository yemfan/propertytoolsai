import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { tool?: string };
    const tool = String(body.tool ?? "").trim();
    if (!tool) {
      return NextResponse.json({ ok: false, error: "tool is required." }, { status: 400 });
    }

    const { data, error } = await supabaseServer.rpc("increment_usage", {
      p_user_id: user.id,
      p_tool: tool,
    } as any);

    if (error) throw error;
    const out = data as any;
    if (!out?.ok) {
      const status = Number(out?.status ?? 402);
      return NextResponse.json(
        {
          ok: false,
          error: "You’ve reached your free limit. Upgrade to continue.",
          tool,
          used: out?.used ?? null,
          limit: out?.limit ?? null,
          reset_at: out?.reset_at ?? null,
        },
        { status: status === 402 ? 402 : 400 }
      );
    }

    return NextResponse.json({ ok: true, tool, used: out?.used ?? null, limit: out?.limit ?? null });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

