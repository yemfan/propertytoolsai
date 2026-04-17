import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  getTemplateForAgent,
  upsertTemplateOverride,
  validateStatus,
} from "@/lib/templates/service";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const { agentId } = await getCurrentAgentContext();
    const template = await getTemplateForAgent(agentId, id);
    if (!template) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, template });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("templates/[id] GET", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json()) as Record<string, unknown>;

    const input: Parameters<typeof upsertTemplateOverride>[2] = {};
    if ("status" in body) {
      const s = validateStatus(body.status);
      if (s) input.status = s;
    }
    if ("subjectOverride" in body) {
      if (body.subjectOverride === null) input.subjectOverride = null;
      else if (typeof body.subjectOverride === "string")
        input.subjectOverride = body.subjectOverride.trim() ? body.subjectOverride : null;
    }
    if ("bodyOverride" in body) {
      if (body.bodyOverride === null) input.bodyOverride = null;
      else if (typeof body.bodyOverride === "string")
        input.bodyOverride = body.bodyOverride.trim() ? body.bodyOverride : null;
    }

    await upsertTemplateOverride(agentId, id, input);
    const template = await getTemplateForAgent(agentId, id);
    return NextResponse.json({ ok: true, template });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("templates/[id] PATCH", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
