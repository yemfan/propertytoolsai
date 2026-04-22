import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  deleteOpenHouse,
  getOpenHouseWithVisitors,
  updateOpenHouse,
  type UpdateOpenHouseInput,
} from "@/lib/open-houses/service";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const result = await getOpenHouseWithVisitors(String(agentId), id);
    if (!result) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET open-houses/[id]:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as UpdateOpenHouseInput;
    const updated = await updateOpenHouse(String(agentId), id, body);
    if (!updated) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, openHouse: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("PATCH open-houses/[id]:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const ok = await deleteOpenHouse(String(agentId), id);
    if (!ok) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("DELETE open-houses/[id]:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
