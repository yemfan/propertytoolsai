import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { getCurrentAgentContext } from "@/lib/dashboardService";

export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const supabase = supabaseServerClient();
    const { data, error } = await supabase
      .from("agents")
      .select("ai_assistant_enabled,ai_assistant_mode")
      .eq("id", agentId)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({
      ok: true,
      settings: {
        ai_assistant_enabled: (data as any)?.ai_assistant_enabled !== false,
        ai_assistant_mode: String((data as any)?.ai_assistant_mode ?? "manual") as "auto" | "manual",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json().catch(() => ({}))) as {
      ai_assistant_enabled?: boolean;
      ai_assistant_mode?: "auto" | "manual";
    };
    const patch: Record<string, unknown> = {};
    if (typeof body.ai_assistant_enabled === "boolean") {
      patch.ai_assistant_enabled = body.ai_assistant_enabled;
    }
    if (body.ai_assistant_mode === "auto" || body.ai_assistant_mode === "manual") {
      patch.ai_assistant_mode = body.ai_assistant_mode;
    }
    if (!Object.keys(patch).length) {
      return NextResponse.json({ ok: false, error: "No valid fields." }, { status: 400 });
    }

    const supabase = supabaseServerClient();
    const { data, error } = await supabase
      .from("agents")
      .update(patch as any)
      .eq("id", agentId)
      .select("ai_assistant_enabled,ai_assistant_mode")
      .maybeSingle();
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      settings: {
        ai_assistant_enabled: (data as any)?.ai_assistant_enabled !== false,
        ai_assistant_mode: String((data as any)?.ai_assistant_mode ?? "manual"),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
