import { NextResponse } from "next/server";
import { getContacts } from "@/lib/dashboardService";
import { loadReceptionistContext, loadSalesCallContext } from "@/lib/voice-agent/context";
import { placeOutboundCall } from "@/lib/voice-agent/outbound";
import { normalizePhoneE164, type OutboundPurpose } from "@repo/voice";
import { requireCrmFeature } from "@/lib/billing/guard";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Cap per batch — guards against runaway cost and Retell concurrency limits. */
const MAX_BULK = 25;
const VALID_PURPOSES: OutboundPurpose[] = ["follow_up", "appointment_reminder", "survey", "promo"];

/**
 * Place AI outbound calls to a batch of selected CRM contacts. Each call is the
 * same as a single "AI Call" (Lucy dials, discloses she's an AI, follows up) and
 * is logged to the activity feed. Calls are paced so we don't slam Retell.
 */
export async function POST(req: Request) {
  try {
    const gate = await requireCrmFeature("ai_calling");
    if (!gate.ok) return gate.response;
    const { agentId } = gate.ctx;
    const body = (await req.json().catch(() => ({}))) as {
      contactIds?: unknown;
      purpose?: OutboundPurpose;
      detail?: string;
    };
    const ids = Array.isArray(body.contactIds)
      ? Array.from(new Set(body.contactIds.map((x) => String(x)).filter(Boolean)))
      : [];
    const purpose: OutboundPurpose = VALID_PURPOSES.includes(body.purpose as OutboundPurpose)
      ? (body.purpose as OutboundPurpose)
      : "follow_up";
    const detail = body.detail ? String(body.detail).trim() : undefined;

    if (ids.length === 0) {
      return NextResponse.json({ ok: false, error: "Select at least one contact." }, { status: 400 });
    }
    if (ids.length > MAX_BULK) {
      return NextResponse.json(
        { ok: false, error: `Too many at once — call up to ${MAX_BULK} contacts per batch.` },
        { status: 400 },
      );
    }

    // Lead-facing purposes are the Sales Assistant's work (its own
    // voice + knowledge); appointment reminders stay with the Receptionist.
    const ctx =
      purpose === "appointment_reminder"
        ? await loadReceptionistContext(agentId)
        : await loadSalesCallContext(agentId);
    if (!ctx) {
      return NextResponse.json(
        { ok: false, error: "Your AI receptionist is turned off — enable it in Settings → Voice." },
        { status: 400 },
      );
    }

    // Resolve the selected ids to the agent's own contacts (RLS-scoped).
    const all = await getContacts(500);
    const byId = new Map(all.map((c) => [String(c.id), c]));
    const selected = ids.map((id) => byId.get(id)).filter((c): c is (typeof all)[number] => Boolean(c));

    const results: Array<{ id: string; name: string; phone: string | null; ok: boolean; error?: string }> = [];
    for (const c of selected) {
      const name = (c.name ?? "").trim();
      const norm = normalizePhoneE164(String(c.phone ?? "").trim());
      if (!norm.ok) {
        results.push({ id: String(c.id), name, phone: c.phone, ok: false, error: "Invalid phone number." });
        continue;
      }
      try {
        await placeOutboundCall({ ctx, agentId, leadName: name, toNumberE164: norm.value, purpose, detail });
        results.push({ id: String(c.id), name, phone: norm.value, ok: true });
      } catch (e) {
        results.push({
          id: String(c.id),
          name,
          phone: norm.value,
          ok: false,
          error: e instanceof Error ? e.message : "Failed to place the call.",
        });
      }
      // Gentle pacing between calls.
      await new Promise((r) => setTimeout(r, 300));
    }

    const placed = results.filter((r) => r.ok).length;
    return NextResponse.json({ ok: true, placed, failed: results.length - placed, total: results.length, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bulk call failed.";
    console.error("voice/outbound-call/bulk", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
