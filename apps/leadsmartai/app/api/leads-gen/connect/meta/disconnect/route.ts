import { NextResponse } from "next/server";
import { z } from "zod";

import { getDashboardAgentContext } from "@/lib/contact-intake/dashboardAgentContext";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const bodySchema = z.object({
  /** Either disconnect a specific connection by id, or all of this agent's Meta connections. */
  id: z.string().uuid().optional(),
  all: z.boolean().optional(),
});

/**
 * POST /api/leads-gen/connect/meta/disconnect
 *
 * Two modes:
 *   { id: "<uuid>" } — disconnect a single Page connection
 *   { all: true }   — disconnect every Meta connection this agent has
 *
 * Deletes the social_accounts row(s). The encrypted tokens are
 * destroyed with the row — we don't soft-delete because tokens
 * are sensitive.
 *
 * Doesn't revoke the OAuth grant on Meta's side; that requires the
 * agent to remove the app from their Facebook settings. We surface
 * this in the success message ("To fully revoke access, also remove
 * LeadSmart AI from your Facebook account's Apps and Websites").
 */
export async function POST(req: Request) {
  try {
    const auth = await getDashboardAgentContext();
    if (auth.ok === false) return auth.response;

    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { id, all } = parsed.data;
    if (!id && !all) {
      return NextResponse.json(
        { ok: false, error: "Pass `id` or `all`." },
        { status: 400 },
      );
    }

    // Count option goes on `.delete()` directly in @supabase/supabase-js v2 —
    // chaining `.select("id", { count: "exact" })` after .delete() trips a
    // TS overload mismatch (Vercel build caught this; local tsc didn't
    // because of a strictness gap). Putting `{ count: 'exact' }` on
    // .delete() gets us the count without the extra .select().
    let query = supabaseAdmin
      .from("social_accounts")
      .delete({ count: "exact" })
      .eq("agent_id", auth.agentId)
      .eq("platform", "meta");
    if (id) query = query.eq("id", id);

    const { error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true, removed: count ?? 0 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Disconnect failed";
    console.error("[leads-gen/connect/meta/disconnect]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
