import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  CoachingEnrollmentError,
  optOut,
} from "@/lib/coaching-programs/service";
import { PROGRAM_ORDER, type ProgramSlug } from "@/lib/coaching-programs/programs";

export const runtime = "nodejs";

/**
 * POST /api/coaching/programs/:slug/opt-out
 *
 * Opt the calling agent out of a coaching program. Sets
 * `opted_out_at`; the row stays so we remember the choice and
 * don't re-enroll on the next auto-enrollment pass.
 *
 * Body (optional): { reason?: string }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await params;
  if (!isProgramSlug(rawSlug)) {
    return NextResponse.json(
      { ok: false, error: "unknown_program" },
      { status: 404 },
    );
  }

  let reason: string | null = null;
  try {
    const body = (await req.json().catch(() => null)) as
      | { reason?: unknown }
      | null;
    if (body && typeof body.reason === "string") {
      const trimmed = body.reason.trim().slice(0, 280);
      reason = trimmed.length > 0 ? trimmed : null;
    }
  } catch {
    // ignore — empty body is fine
  }

  try {
    const ctx = await getCurrentAgentContext();
    const row = await optOut({
      agentId: ctx.agentId,
      programSlug: rawSlug,
      reason,
    });
    return NextResponse.json({ ok: true, enrollment: row });
  } catch (e) {
    if (e instanceof CoachingEnrollmentError) {
      const status = e.code === "not_enrolled" ? 404 : 400;
      return NextResponse.json(
        { ok: false, error: e.code, message: e.message },
        { status },
      );
    }
    return NextResponse.json(
      { ok: false, error: "opt_out_failed", message: (e as Error).message },
      { status: 500 },
    );
  }
}

function isProgramSlug(s: string): s is ProgramSlug {
  return (PROGRAM_ORDER as string[]).includes(s);
}
