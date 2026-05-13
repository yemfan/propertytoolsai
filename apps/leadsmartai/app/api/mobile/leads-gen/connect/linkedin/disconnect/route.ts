import { NextResponse } from "next/server";
import { z } from "zod";

import { requireMobileAgent } from "@/lib/mobile/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const bodySchema = z.object({
  /** Either disconnect a specific connection by id, or all LinkedIn connections. */
  id: z.string().uuid().optional(),
  all: z.boolean().optional(),
});

/**
 * POST /api/mobile/leads-gen/connect/linkedin/disconnect
 *
 * Mobile-side counterpart to /api/leads-gen/connect/linkedin/disconnect.
 * Mirrors the Meta disconnect — delete the social_accounts row(s)
 * for this agent's LinkedIn connections.
 */
export async function POST(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: "Invalid body",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }
    const { id, all } = parsed.data;
    if (!id && !all) {
      return NextResponse.json(
        { ok: false, success: false, error: "Pass `id` or `all`." },
        { status: 400 },
      );
    }

    let query = supabaseAdmin
      .from("social_accounts")
      .delete({ count: "exact" })
      .eq("agent_id", auth.ctx.agentId)
      .eq("platform", "linkedin");
    if (id) query = query.eq("id", id);

    const { error, count } = await query;
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      success: true,
      removed: count ?? 0,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Disconnect failed";
    console.error("[mobile/leads-gen/connect/linkedin/disconnect]", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}
