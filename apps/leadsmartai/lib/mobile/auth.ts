import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type MobileAgentContext = {
  userId: string;
  agentId: string;
};

/**
 * Bearer or cookie session + agents row (same rule as dashboard CRM).
 */
export async function requireMobileAgent(
  req: Request
): Promise<{ ok: true; ctx: MobileAgentContext } | { ok: false; response: NextResponse }> {
  const user = await getUserFromRequest(req);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, success: false, error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  const { data: agentRow, error } = await supabaseAdmin
    .from("agents")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("mobile auth: agents lookup", error);
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, success: false, error: "Server error" },
        { status: 500 }
      ),
    };
  }

  const rawId = (agentRow as { id?: unknown } | null)?.id;
  if (rawId == null || rawId === "") {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          success: false,
          error: "Complete agent signup before using the mobile app.",
          code: "NO_AGENT_ROW",
        },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    ctx: { userId: user.id, agentId: String(rawId) },
  };
}
