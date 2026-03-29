import { NextResponse } from "next/server";
import { MessageSender, SupportMessageType, SupportStatus } from "@prisma/client";
import { isPrismaConfigured, prisma } from "@/lib/prisma";
import { isActiveSupportStatus } from "@/lib/supportConversationActive";
import { supportMessageToPublicJson } from "@/lib/supportMessagePublic";
import { WELCOME_SYSTEM_TEXT } from "@/lib/supportChatConstants";

const publicMessagesInclude = {
  where: { isInternalNote: false },
  orderBy: { createdAt: "asc" as const },
};

type Body = {
  name?: string;
  email?: string;
  subject?: string;
  customerUserId?: string;
  /** Resume existing thread when still active */
  publicId?: string;
};

export async function POST(req: Request) {
  if (!isPrismaConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Support database is not configured (DATABASE_URL)." },
      { status: 503 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const customerName = String(body.name ?? "").trim();
  const customerEmail = String(body.email ?? "").trim().toLowerCase();
  const subject = body.subject ? String(body.subject).trim() : null;
  const customerUserId = body.customerUserId ? String(body.customerUserId).trim() : null;

  if (customerName.length < 2 || !/.+@.+\..+/.test(customerEmail)) {
    return NextResponse.json({ ok: false, error: "Name and valid email are required." }, { status: 400 });
  }

  try {
    if (body.publicId) {
      const existing = await prisma.supportConversation.findUnique({
        where: { publicId: body.publicId },
        include: {
          messages: publicMessagesInclude,
        },
      });

      if (existing && isActiveSupportStatus(existing.status)) {
        await prisma.supportConversation.update({
          where: { id: existing.id },
          data: {
            customerName,
            customerEmail,
            subject: subject ?? existing.subject,
            customerUserId: customerUserId ?? existing.customerUserId,
            updatedAt: new Date(),
          },
        });

        const refreshed = await prisma.supportConversation.findUnique({
          where: { id: existing.id },
          include: { messages: publicMessagesInclude },
        });

        if (!refreshed) {
          return NextResponse.json({ ok: false, error: "Conversation not found." }, { status: 404 });
        }

        return NextResponse.json({
          ok: true,
          conversation: {
            publicId: refreshed.publicId,
            status: refreshed.status,
            name: refreshed.customerName,
            email: refreshed.customerEmail,
            subject: refreshed.subject,
            unreadForCustomer: refreshed.unreadForCustomer,
            unreadForSupport: refreshed.unreadForSupport,
          },
          messages: refreshed.messages.map(supportMessageToPublicJson),
        });
      }
    }

    const now = new Date();
    const created = await prisma.supportConversation.create({
      data: {
        customerName,
        customerEmail,
        customerUserId,
        subject,
        source: "website_chat",
        status: SupportStatus.open,
        lastMessageAt: now,
        lastMessageBy: MessageSender.system,
        messages: {
          create: {
            senderType: MessageSender.system,
            body: WELCOME_SYSTEM_TEXT,
            messageType: SupportMessageType.system_event,
          },
        },
      },
      include: {
        messages: publicMessagesInclude,
      },
    });

    return NextResponse.json({
      ok: true,
      conversation: {
        publicId: created.publicId,
        status: created.status,
        name: created.customerName,
        email: created.customerEmail,
        subject: created.subject,
        unreadForCustomer: created.unreadForCustomer,
        unreadForSupport: created.unreadForSupport,
      },
      messages: created.messages.map(supportMessageToPublicJson),
    });
  } catch (e: unknown) {
    console.error("support conversation create", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
