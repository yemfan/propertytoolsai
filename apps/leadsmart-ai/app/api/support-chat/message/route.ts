import { NextResponse } from "next/server";
import { sendMessageSchema } from "@/lib/support-chat/schema";
import { addMessage, type AddMessageInput } from "@/lib/support-chat/service";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = sendMessageSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const message = await addMessage(parsed.data as AddMessageInput);

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "Failed to send message" },
      { status: 500 }
    );
  }
}
