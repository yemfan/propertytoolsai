import { NextResponse } from "next/server";
import { updateConversationSchema } from "@/lib/support-chat/schema";
import {
  updateConversation,
  type UpdateConversationInput,
} from "@/lib/support-chat/service";

export async function PATCH(req: Request) {
  try {
    const json = await req.json();
    const parsed = updateConversationSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const conversation = await updateConversation(parsed.data as UpdateConversationInput);

    return NextResponse.json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "Failed to update conversation" },
      { status: 500 }
    );
  }
}
