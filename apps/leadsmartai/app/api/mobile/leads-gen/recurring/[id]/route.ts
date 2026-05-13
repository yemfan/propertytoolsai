import { NextResponse } from "next/server";
import { z } from "zod";

import { requireMobileAgent } from "@/lib/mobile/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const patchSchema = z.object({
  action: z.enum(["pause", "resume", "cancel"]),
});

/**
 * PATCH /api/mobile/leads-gen/recurring/[id]
 *
 * Mobile-side counterpart to /api/leads-gen/recurring/[id]. Same
 * transitions: active ↔ paused, anything → cancelled. Cancel is
 * terminal; agent has to create a new recurrence to start over.
 */
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await context.params;
    const json = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(json);
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
    const { action } = parsed.data;

    const { data: row, error: readErr } = await supabaseAdmin
      .from("recurring_post_schedules")
      .select("id, status")
      .eq("id", id)
      .eq("agent_id", auth.ctx.agentId)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!row) {
      return NextResponse.json(
        { ok: false, success: false, error: "Recurrence not found." },
        { status: 404 },
      );
    }
    const current = (row as { status: string }).status;

    let nextStatus: "active" | "paused" | "cancelled";
    if (action === "pause") {
      if (current !== "active") {
        return NextResponse.json(
          {
            ok: false,
            success: false,
            error: `Cannot pause from status "${current}".`,
          },
          { status: 422 },
        );
      }
      nextStatus = "paused";
    } else if (action === "resume") {
      if (current !== "paused") {
        return NextResponse.json(
          {
            ok: false,
            success: false,
            error: `Cannot resume from status "${current}".`,
          },
          { status: 422 },
        );
      }
      nextStatus = "active";
    } else {
      if (current === "cancelled" || current === "completed") {
        return NextResponse.json(
          { ok: false, success: false, error: `Already ${current}.` },
          { status: 422 },
        );
      }
      nextStatus = "cancelled";
    }

    const { error: updateErr } = await supabaseAdmin
      .from("recurring_post_schedules")
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq("id", id)
      .eq("agent_id", auth.ctx.agentId);
    if (updateErr) throw updateErr;

    return NextResponse.json({ ok: true, success: true, status: nextStatus });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    console.error("[mobile/leads-gen/recurring/[id]]", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}
