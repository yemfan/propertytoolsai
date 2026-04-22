import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
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
 * POST /api/dashboard/transactions/[id]/tasks
 * Add a custom task to the transaction's checklist. Seeded tasks
 * continue to live alongside; the UI distinguishes by `source`.
 *
 * Body: { stage, title, description?, due_date? }
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as {
      stage?: string;
      title?: string;
      description?: string | null;
      due_date?: string | null;
    };
    if (!body.stage || !VALID_STAGES.includes(body.stage as TransactionStage)) {
      return NextResponse.json(
        { ok: false, error: `stage must be one of ${VALID_STAGES.join(", ")}` },
        { status: 400 },
      );
    }
    if (!body.title || typeof body.title !== "string") {
      return NextResponse.json({ ok: false, error: "title is required" }, { status: 400 });
    }
    const task = await addCustomTask(String(agentId), id, {
      stage: body.stage as TransactionStage,
      title: body.title,
      description: body.description ?? null,
      due_date: body.due_date ?? null,
    });
    return NextResponse.json({ ok: true, task });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error(`POST /api/dashboard/transactions/[id]/tasks:`, err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
