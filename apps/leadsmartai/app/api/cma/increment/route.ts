import { NextResponse } from "next/server";
import { incrementCmaUsage } from "@/lib/cmaUsage";

export async function POST(req: Request) {
  try {
    const usage = await incrementCmaUsage(req);
    if (usage.reached && usage.remaining === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "You’ve reached your limit",
          usage,
        },
        { status: 402 }
      );
    }
    return NextResponse.json({ ok: true, usage });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

