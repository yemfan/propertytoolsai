import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { PLAYBOOKS } from "@/lib/playbooks/definitions";
import {
  applyPlaybook,
  listAllTasksForAgent,
  listTasksForAnchor,
} from "@/lib/playbooks/service";
import type { PlaybookAnchor } from "@/lib/playbooks/definitions";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/playbooks
 *   If no query params, returns the static playbook library metadata
 *   (used by the picker modal).
 *   With ?anchorKind=…&anchorId=…, returns the agent's task
 *   instances for that anchor.
 *
 * POST /api/dashboard/playbooks
 *   Applies a playbook to an anchor. Body:
 *     { templateKey, anchorKind, anchorId, anchorDate }
 */

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const anchorKind = url.searchParams.get("anchorKind");
    const anchorId = url.searchParams.get("anchorId");

    const all = url.searchParams.get("all") === "1";

    if (!anchorKind && !all) {
      // Metadata-only catalog for the picker.
      return NextResponse.json({
        ok: true,
        playbooks: PLAYBOOKS.map((p) => ({
          key: p.key,
          category: p.category,
          title: p.title,
          description: p.description,
          validAnchors: p.validAnchors,
          anchorHint: p.anchorHint,
          itemCount: p.items.length,
        })),
      });
    }

    const { agentId } = await getCurrentAgentContext();

    if (all) {
      const includeCompleted = url.searchParams.get("includeCompleted") === "1";
      const tasks = await listAllTasksForAgent(String(agentId), { includeCompleted });
      return NextResponse.json({ ok: true, tasks });
    }

    const tasks = await listTasksForAnchor(
      String(agentId),
      anchorKind as PlaybookAnchor,
      anchorId && anchorId !== "null" ? anchorId : null,
    );
    return NextResponse.json({ ok: true, tasks });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET /api/dashboard/playbooks:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json().catch(() => ({}))) as Partial<{
      templateKey: string;
      anchorKind: PlaybookAnchor;
      anchorId: string | null;
      anchorDate: string;
    }>;
    if (!body.templateKey || !body.anchorKind || !body.anchorDate) {
      return NextResponse.json(
        { ok: false, error: "templateKey, anchorKind, and anchorDate are required." },
        { status: 400 },
      );
    }
    const result = await applyPlaybook({
      agentId: String(agentId),
      templateKey: body.templateKey,
      anchorKind: body.anchorKind,
      anchorId: body.anchorId ?? null,
      anchorDate: body.anchorDate,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/dashboard/playbooks:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
