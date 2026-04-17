import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  createAdhocDraft,
  createDraftFromTemplate,
  listDrafts,
} from "@/lib/drafts/service";
import type { DraftChannel, DraftStatus } from "@/lib/drafts/types";

export const runtime = "nodejs";

const STATUSES: readonly (DraftStatus | "all")[] = [
  "pending",
  "approved",
  "rejected",
  "sent",
  "failed",
  "all",
];

function parseStatus(v: string | null): DraftStatus | "all" {
  return v && (STATUSES as readonly string[]).includes(v)
    ? (v as DraftStatus | "all")
    : "pending";
}

export async function GET(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const url = new URL(req.url);
    const status = parseStatus(url.searchParams.get("status"));
    const drafts = await listDrafts(agentId, status);
    return NextResponse.json({ ok: true, drafts });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("drafts GET", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json()) as Record<string, unknown>;

    const contactId = typeof body.contactId === "string" ? body.contactId : null;
    if (!contactId) {
      return NextResponse.json({ ok: false, error: "contactId required" }, { status: 400 });
    }

    if (typeof body.templateId === "string") {
      const draft = await createDraftFromTemplate(agentId, contactId, body.templateId);
      return NextResponse.json({ ok: true, draft });
    }

    const channel = body.channel === "email" ? "email" : "sms";
    const subject = typeof body.subject === "string" ? body.subject : null;
    const draftBody = typeof body.body === "string" ? body.body : "";
    if (!draftBody.trim()) {
      return NextResponse.json({ ok: false, error: "body required" }, { status: 400 });
    }
    const draft = await createAdhocDraft(
      agentId,
      contactId,
      channel as DraftChannel,
      subject,
      draftBody,
    );
    return NextResponse.json({ ok: true, draft });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = /does not belong|not found/i.test(msg) ? 403 : 500;
    console.error("drafts POST", e);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
