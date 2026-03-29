import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { recordFunnelEvent } from "@/lib/funnel/funnelAnalytics";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const bodySchema = z.object({
  event: z.enum(["upgrade_modal_prompt"]),
  reason: z.string().max(120).optional(),
});

const PROMPT_COOLDOWN_HOURS = 18;

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserWithRole(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid event" }, { status: 400 });
    }

    if (parsed.data.event === "upgrade_modal_prompt") {
      const since = new Date(Date.now() - PROMPT_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
      const { data: row } = await supabaseAdmin
        .from("leadsmart_funnel_state")
        .select("last_upgrade_prompt_at")
        .eq("user_id", user.id)
        .maybeSingle();

      const last = (row as { last_upgrade_prompt_at?: string | null } | null)?.last_upgrade_prompt_at;
      if (last && last >= since) {
        return NextResponse.json({ ok: true, skipped: true, reason: "cooldown" });
      }

      const now = new Date().toISOString();
      await supabaseAdmin.from("leadsmart_funnel_state").upsert(
        {
          user_id: user.id,
          last_upgrade_prompt_at: now,
          updated_at: now,
        },
        { onConflict: "user_id" }
      );

      await recordFunnelEvent(user.id, "upgrade_modal_prompt", {
        uiReason: parsed.data.reason ?? null,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
