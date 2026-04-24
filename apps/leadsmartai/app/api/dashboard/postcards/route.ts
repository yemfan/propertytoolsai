import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  createPostcardSend,
  listPostcardsForAgent,
  type Channel,
} from "@/lib/postcards/service";
import type { PostcardTemplateKey } from "@/lib/postcards/templates";

export const runtime = "nodejs";

const ALLOWED_CHANNELS: Channel[] = ["email", "sms", "wechat"];

/**
 * GET  /api/dashboard/postcards                  — list agent's recent sends
 * GET  /api/dashboard/postcards?contactId=XYZ    — filter to one contact
 * POST /api/dashboard/postcards                  — create + dispatch a send
 *
 * POST body:
 *   { contactId?, templateKey, recipientName, recipientEmail?,
 *     recipientPhone?, personalMessage?, channels: ("email"|"sms"|"wechat")[] }
 */
export async function GET(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const url = new URL(req.url);
    const contactId = url.searchParams.get("contactId");
    const rows = await listPostcardsForAgent(String(agentId), {
      contactId: contactId || null,
    });
    return NextResponse.json({ ok: true, postcards: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET /api/dashboard/postcards:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json().catch(() => ({}))) as {
      contactId?: string | null;
      templateKey?: string;
      recipientName?: string;
      recipientEmail?: string | null;
      recipientPhone?: string | null;
      personalMessage?: string | null;
      channels?: string[];
    };

    if (!body.templateKey) {
      return NextResponse.json(
        { ok: false, error: "templateKey is required" },
        { status: 400 },
      );
    }
    if (!body.recipientName?.trim()) {
      return NextResponse.json(
        { ok: false, error: "recipientName is required" },
        { status: 400 },
      );
    }
    const channels = (body.channels ?? []).filter((c): c is Channel =>
      ALLOWED_CHANNELS.includes(c as Channel),
    );
    if (!channels.length) {
      return NextResponse.json(
        { ok: false, error: "Pick at least one delivery channel" },
        { status: 400 },
      );
    }

    const result = await createPostcardSend({
      agentId: String(agentId),
      contactId: body.contactId ?? null,
      templateKey: body.templateKey as PostcardTemplateKey,
      recipientName: body.recipientName,
      recipientEmail: body.recipientEmail,
      recipientPhone: body.recipientPhone,
      personalMessage: body.personalMessage,
      channels,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/dashboard/postcards:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
