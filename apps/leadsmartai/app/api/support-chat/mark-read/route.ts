import { NextResponse } from "next/server";
import { markReadSchema } from "@/lib/support-chat/schema";
import {
  markConversationRead,
  type MarkConversationReadInput,
} from "@/lib/support-chat/service";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = markReadSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await markConversationRead(parsed.data as MarkConversationReadInput);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "Failed to mark as read" },
      { status: 500 }
    );
  }
}
