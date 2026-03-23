import { NextResponse } from "next/server";
import { startConversationSchema } from "@/lib/support-chat/schema";
import {
  createConversation,
  type CreateConversationInput,
} from "@/lib/support-chat/service";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = startConversationSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const conversation = await createConversation(parsed.data as CreateConversationInput);

    return NextResponse.json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "Failed to start conversation" },
      { status: 500 }
    );
  }
}
