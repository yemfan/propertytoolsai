import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import {
  createPostcardSend,
  listPostcardsForAgent,
  type Channel,
  type CreateSendInput,
} from "@/lib/postcards/service";
import {
  POSTCARD_TEMPLATES,
  type PostcardTemplateKey,
} from "@/lib/postcards/templates";

export const runtime = "nodejs";

const VALID_TEMPLATES = new Set<string>(POSTCARD_TEMPLATES.map((t) => t.key));
const VALID_CHANNELS: Channel[] = ["email", "sms", "wechat"];
const VALID_CHANNEL_SET = new Set<string>(VALID_CHANNELS);

/**
 * GET /api/mobile/postcards
 *   Returns { postcards } — agent-scoped recent sends with status.
 *
 * POST /api/mobile/postcards
 *   Creates a postcard send + dispatches on every requested channel
 *   in one shot. Same wire as the dashboard but Bearer-auth'd.
 *
 *   Body: { templateKey, recipientName, recipientEmail?, recipientPhone?,
 *           personalMessage?, channels[], contactId? }
 */
export async function GET(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;
  try {
    const url = new URL(req.url);
    const contactId = url.searchParams.get("contactId") || undefined;
    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit") ?? "50"), 1),
      200,
    );
    const postcards = await listPostcardsForAgent(auth.ctx.agentId, {
      contactId,
      limit,
    });
    return NextResponse.json({ ok: true, success: true, postcards });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/mobile/postcards", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<CreateSendInput>;

    if (
      !body.templateKey ||
      !VALID_TEMPLATES.has(String(body.templateKey))
    ) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: `templateKey must be one of: ${POSTCARD_TEMPLATES.map((t) => t.key).join(", ")}`,
        },
        { status: 400 },
      );
    }
    const recipientName = body.recipientName?.toString().trim();
    if (!recipientName) {
      return NextResponse.json(
        { ok: false, success: false, error: "recipientName is required." },
        { status: 400 },
      );
    }
    const channelsRaw = Array.isArray(body.channels) ? body.channels : [];
    const channels = channelsRaw.filter((c): c is Channel =>
      typeof c === "string" && VALID_CHANNEL_SET.has(c),
    );
    if (channels.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: "Pick at least one delivery channel (email, sms, or wechat).",
        },
        { status: 400 },
      );
    }

    const result = await createPostcardSend({
      agentId: auth.ctx.agentId,
      contactId: body.contactId ?? null,
      templateKey: body.templateKey as PostcardTemplateKey,
      recipientName,
      recipientEmail: body.recipientEmail ?? null,
      recipientPhone: body.recipientPhone ?? null,
      personalMessage: body.personalMessage ?? null,
      channels,
    });

    return NextResponse.json({
      ok: true,
      success: true,
      send: result.send,
      publicUrl: result.publicUrl,
      deliveries: result.deliveries,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/mobile/postcards", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}
