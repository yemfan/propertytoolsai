import { NextResponse } from "next/server";
import { SupportStatus, type SupportConversation, type SupportMessage } from "@prisma/client";
import { isPrismaConfigured, prisma } from "@/lib/prisma";
import { prismaConversationToSummary, prismaConversationToUi } from "@/lib/support/mapPrismaSupportToUi";
import { getSupportStaffContext } from "@/lib/support/supportStaffAuth";

const ALLOWED_STATUS = new Set<string>(Object.values(SupportStatus));

/**
 * List support conversations (admin or agent). Includes internal notes.
 * Optional query: `status` (SupportStatus) to filter.
 */
export async function GET(req: Request) {
  const staff = await getSupportStaffContext();
  if (!staff) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isPrismaConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Support database is not configured (DATABASE_URL).", code: "NO_DB" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const compact =
    searchParams.get("compact") === "1" || searchParams.get("compact") === "true";

  let statusFilter: SupportStatus | undefined;
  if (statusParam !== null && statusParam !== "") {
    if (!ALLOWED_STATUS.has(statusParam)) {
      return NextResponse.json({ ok: false, error: "Invalid status." }, { status: 400 });
    }
    statusFilter = statusParam as SupportStatus;
  }

  try {
    const rows = await prisma.supportConversation.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      take: compact ? 100 : 250,
      include: compact
        ? undefined
        : {
            messages: { orderBy: { createdAt: "asc" } },
          },
    });

    return NextResponse.json({
      ok: true,
      compact: compact || undefined,
      conversations: compact
        ? rows.map((r) => {
            const s = prismaConversationToSummary(r);
            return { ...s, messages: [] };
          })
        : rows.map((r) =>
            prismaConversationToUi(r as SupportConversation & { messages: SupportMessage[] })
          ),
    });
  } catch (e: unknown) {
    console.error("support conversations list", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
