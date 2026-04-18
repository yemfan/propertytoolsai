import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { createSignal, listOpenSignals } from "@/lib/contacts/service";
import type { ContactSignalType } from "@/lib/contacts/types";

export const runtime = "nodejs";

const SIGNAL_TYPES: readonly ContactSignalType[] = [
  "equity_milestone",
  "refi_detected",
  "job_change",
  "anniversary_due",
  "listing_activity",
  "life_event_other",
];

const CONFIDENCE = ["low", "medium", "high"] as const;
type Confidence = (typeof CONFIDENCE)[number];

function parseType(v: unknown): ContactSignalType | null {
  return typeof v === "string" && SIGNAL_TYPES.includes(v as ContactSignalType)
    ? (v as ContactSignalType)
    : null;
}

function parseConfidence(v: unknown): Confidence | undefined {
  return typeof v === "string" && (CONFIDENCE as readonly string[]).includes(v)
    ? (v as Confidence)
    : undefined;
}

export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const signals = await listOpenSignals(agentId);
    return NextResponse.json({ ok: true, signals });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json()) as Record<string, unknown>;

    const contactId = typeof body.contactId === "string" ? body.contactId : null;
    const type = parseType(body.type);
    const label = typeof body.label === "string" ? body.label.trim() : "";

    if (!contactId) {
      return NextResponse.json({ ok: false, error: "contactId required" }, { status: 400 });
    }
    if (!type) {
      return NextResponse.json({ ok: false, error: "Invalid signal type" }, { status: 400 });
    }
    if (!label) {
      return NextResponse.json({ ok: false, error: "label required" }, { status: 400 });
    }

    const suggestedAction =
      typeof body.suggestedAction === "string" ? body.suggestedAction : null;

    const signal = await createSignal(agentId, {
      contactId,
      type,
      label,
      confidence: parseConfidence(body.confidence),
      suggestedAction,
    });
    return NextResponse.json({ ok: true, signal });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = /does not belong|not found/i.test(msg) ? 403 : 500;
    console.error("sphere/signals POST", e);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
