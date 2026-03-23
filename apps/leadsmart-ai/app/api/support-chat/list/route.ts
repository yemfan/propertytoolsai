import { NextResponse } from "next/server";
import { listConversations } from "@/lib/support-chat/service";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const conversations = await listConversations({
      status: searchParams.get("status") || undefined,
      assignedAgentId: searchParams.get("assignedAgentId") || undefined,
      customerEmail: searchParams.get("customerEmail") || undefined,
    });

    return NextResponse.json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "Failed to list conversations" },
      { status: 500 }
    );
  }
}
