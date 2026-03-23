import { NextResponse } from "next/server";
import { MessageSender, SupportStatus } from "@prisma/client";
import { isPrismaConfigured, prisma } from "@/lib/prisma";
import { supportMessageToPublicJson } from "@/lib/supportMessagePublic";

/**
 * Support/agent replies from tooling. Protect with `SUPPORT_REPLY_SECRET` (Bearer).
 * Increments `unreadForCustomer` until the visitor opens the chat (PATCH …/read).
 */
export async function POST(req: Request) {
  if (!isPrismaConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Support database is not configured (DATABASE_URL)." },
      { status: 503 }
    );
  }

  const secret = process.env.SUPPORT_REPLY_SECRET?.trim();
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!secret || token !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: { publicId?: string; body?: string; senderName?: string; senderEmail?: string };
  try {
    body = (await req.json()) as {
      publicId?: string;
      body?: string;
      senderName?: string;
      senderEmail?: string;
    };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const publicId = String(body.publicId ?? "").trim();
  const text = String(body.body ?? "").trim();
  const senderName = body.senderName ? String(body.senderName).trim() : null;
  const senderEmail = body.senderEmail ? String(body.senderEmail).trim() : null;

  if (!publicId || !text || text.length > 8000) {
    return NextResponse.json({ ok: false, error: "publicId and body are required." }, { status: 400 });
  }

  try {
    const conv = await prisma.supportConversation.findUnique({
      where: { publicId },
    });

    if (!conv) {
      return NextResponse.json({ ok: false, error: "Conversation not found." }, { status: 404 });
    }

    const now = new Date();
    const msg = await prisma.$transaction(async (tx) => {
      const m = await tx.supportMessage.create({
        data: {
          conversationId: conv.id,
          senderType: MessageSender.support,
          senderName,
          senderEmail,
          body: text,
        },
      });

      await tx.supportConversation.update({
        where: { id: conv.id },
        data: {
          lastMessageAt: now,
          lastMessageBy: MessageSender.support,
          status: SupportStatus.waiting_on_customer,
          unreadForCustomer: { increment: 1 },
          unreadForSupport: 0,
          updatedAt: now,
        },
      });

      return m;
    });

    return NextResponse.json({
      ok: true,
      message: supportMessageToPublicJson(msg),
    });
  } catch (e: unknown) {
    console.error("support internal reply", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
