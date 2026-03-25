import { NextResponse } from "next/server";
import { getAffordabilitySession } from "@/lib/affordability/session-store";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ success: false, error: "Missing sessionId" }, { status: 400 });
    }

    const session = await getAffordabilitySession(sessionId);
    return NextResponse.json({ success: true, session });
  } catch (error) {
    console.error("affordability session error:", error);
    return NextResponse.json({ success: false, error: "Failed to load session" }, { status: 500 });
  }
}
