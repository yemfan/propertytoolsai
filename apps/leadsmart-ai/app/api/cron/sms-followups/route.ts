import { NextResponse } from "next/server";
import { runSmsFollowupCron } from "@/lib/smsAutoFollow";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await runSmsFollowupCron();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
