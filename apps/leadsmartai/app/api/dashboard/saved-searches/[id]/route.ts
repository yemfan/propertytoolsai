import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  archiveSavedSearch,
  getSavedSearch,
  updateSavedSearch,
} from "@/lib/contacts/savedSearches";
import type {
  AlertFrequency,
  SavedSearchCriteria,
} from "@/lib/contacts/types";

export const runtime = "nodejs";

const ALERT_FREQUENCIES: readonly AlertFrequency[] = [
  "instant",
  "daily",
  "weekly",
  "never",
];

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const search = await getSavedSearch(agentId, id);
    if (!search) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, search });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = /does not belong|not found/i.test(msg) ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      name?: unknown;
      criteria?: unknown;
      alertFrequency?: unknown;
      isActive?: unknown;
    };

    const patch: Parameters<typeof updateSavedSearch>[2] = {};
    if (typeof body.name === "string") patch.name = body.name;
    if (body.criteria && typeof body.criteria === "object" && !Array.isArray(body.criteria)) {
      patch.criteria = body.criteria as SavedSearchCriteria;
    }
    if (
      typeof body.alertFrequency === "string" &&
      (ALERT_FREQUENCIES as readonly string[]).includes(body.alertFrequency)
    ) {
      patch.alertFrequency = body.alertFrequency as AlertFrequency;
    }
    if (typeof body.isActive === "boolean") patch.isActive = body.isActive;

    const search = await updateSavedSearch(agentId, id, patch);
    return NextResponse.json({ ok: true, search });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = /does not belong|not found|cannot be empty/i.test(msg) ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    await archiveSavedSearch(agentId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = /does not belong|not found/i.test(msg) ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
