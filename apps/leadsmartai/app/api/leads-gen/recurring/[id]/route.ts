import { NextResponse } from "next/server";
import { z } from "zod";

import { getDashboardAgentContext } from "@/lib/contact-intake/dashboardAgentContext";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const patchSchema = z.object({
  action: z.enum(["pause", "resume", "cancel"]),
});

/**
 * PATCH /api/leads-gen/recurring/[id]
 *
 * Lifecycle actions on a recurrence:
 *   - pause:  active → paused. Materialize cron skips paused rows.
 *   - resume: paused → active. Picks up where it left off — the
 *             stored next_occurrence_at is unchanged, so if the
 *             agent paused for a week the recurrence may fire
 *             immediately on resume (or whenever the existing
 *             next_occurrence_at lands). That's intentional — the
 *             alternative (fast-forward through skipped occurrences)
 *             would dump a stack of "now" posts on resume which is
 *             worse.
 *   - cancel: terminal. Material cron skips cancelled rows. Cannot
 *             be undone — agent has to create a new recurrence.
 *
 * No DELETE — we keep the row for audit + the back-link from
 * already-materialized scheduled_posts rows.
 */
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getDashboardAgentContext();
    if (auth.ok === false) return auth.response;

    const { id } = await context.params;
    const json = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { action } = parsed.data;

    // Read first so we can validate the transition.
    const { data: row, error: readErr } = await supabaseAdmin
      .from("recurring_post_schedules")
      .select("id, status")
      .eq("id", id)
      .eq("agent_id", auth.agentId)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!row) {
      return NextResponse.json(
        { ok: false, error: "Recurrence not found." },
        { status: 404 },
      );
    }
    const current = (row as { status: string }).status;

    let nextStatus: "active" | "paused" | "cancelled";
    if (action === "pause") {
      if (current !== "active") {
        return NextResponse.json(
          { ok: false, error: `Cannot pause from status "${current}".` },
          { status: 422 },
        );
      }
      nextStatus = "paused";
    } else if (action === "resume") {
      if (current !== "paused") {
        return NextResponse.json(
          { ok: false, error: `Cannot resume from status "${current}".` },
          { status: 422 },
        );
      }
      nextStatus = "active";
    } else {
      if (current === "cancelled" || current === "completed") {
        return NextResponse.json(
          { ok: false, error: `Already ${current}.` },
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
      .eq("agent_id", auth.agentId);
    if (updateErr) throw updateErr;

    return NextResponse.json({ ok: true, status: nextStatus });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    console.error("[leads-gen/recurring/[id]]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
