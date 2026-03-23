import { NextResponse } from "next/server";
import { getConversationByPublicId } from "@/lib/support-chat/service";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationPublicId = searchParams.get("conversationPublicId");

    if (!conversationPublicId) {
      return NextResponse.json(
        { success: false, error: "Missing conversationPublicId" },
        { status: 400 }
      );
    }

    const conversation = await getConversationByPublicId(conversationPublicId);

    return NextResponse.json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch conversation" },
      { status: 500 }
    );
  }
}
