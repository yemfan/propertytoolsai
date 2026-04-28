import { NextResponse } from "next/server";

import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  getEffectiveForAgent,
  upsertPrefsForAgent,
} from "@/lib/sphereDrip/prefsDbService";

export const runtime = "nodejs";

/**
 * Per-agent sphere-drip preferences.
 *
 *   GET   — read effective state (DB row + env overlay + resolved
 *           enabled value + source attribution for the UI).
 *   PATCH — upsert this agent's row.
 *
 * Auth via getCurrentAgentContext (throws on unauth / missing agent
 * mapping). RLS on agent_sphere_drip_prefs gates writes at the DB
 * layer too — agent can only write to their own row.
 */
export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const prefs = await getEffectiveForAgent(String(agentId));
    return NextResponse.json({ ok: true, prefs });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json().catch(() => ({}))) as {
      enabled?: unknown;
      notes?: unknown;
    };

    if (typeof body.enabled !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "enabled (boolean) is required." },
        { status: 400 },
      );
    }

    const notes =
      typeof body.notes === "string"
        ? body.notes.trim().slice(0, 500) || null
        : null;

    const saved = await upsertPrefsForAgent({
      agentId: String(agentId),
      enabled: body.enabled,
      notes,
    });

    // Return the FRESH effective state so the UI can re-render the
    // source attribution + env-overlap hint without a separate fetch.
    const prefs = await getEffectiveForAgent(String(agentId));
    return NextResponse.json({ ok: true, prefs, saved });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
