import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { addCustomTask } from "@/lib/transactions/service";
import type { TransactionStage } from "@/lib/transactions/types";

export const runtime = "nodejs";

const VALID_STAGES: readonly TransactionStage[] = [
  "contract",
  "inspection",
  "appraisal",
  "loan",
  "closing",
];

/**
 * POST /api/mobile/transactions/[id]/tasks
 *   Add a custom task to a transaction's checklist. Seeded tasks
 *   come from the buyer-rep / listing-rep templates and are NOT
 *   created via this endpoint — they're inserted at transaction
 *   creation time by the service.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as {
      stage?: string;
      title?: string;
      description?: string | null;
      due_date?: string | null;
    };
    if (!body.stage || !VALID_STAGES.includes(body.stage as TransactionStage)) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: `stage must be one of ${VALID_STAGES.join(", ")}`,
        },
        { status: 400 },
      );
    }
    if (!body.title || typeof body.title !== "string") {
      return NextResponse.json(
        { ok: false, success: false, error: "title is required" },
        { status: 400 },
      );
    }
    const task = await addCustomTask(auth.ctx.agentId, id, {
      stage: body.stage as TransactionStage,
      title: body.title,
      description: body.description ?? null,
      due_date: body.due_date ?? null,
    });
    return NextResponse.json({ ok: true, success: true, task });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/mobile/transactions/[id]/tasks", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}
