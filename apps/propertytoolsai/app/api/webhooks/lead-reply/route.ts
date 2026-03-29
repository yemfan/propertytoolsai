import { NextResponse } from "next/server";
import { handleLeadReply } from "@/lib/home-value/reply-handler";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const leadId = body.leadId;
    const channel = body.channel;
    const message = body.message;

    if (!leadId || !channel || !message) {
      return NextResponse.json(
        { success: false, error: "Missing fields" },
        { status: 400 }
      );
    }

    await handleLeadReply({
      leadId,
      channel,
      message,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("lead reply webhook error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process reply" },
      { status: 500 }
    );
  }
}
