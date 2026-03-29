import { NextResponse } from "next/server";
import { getCmaUsage } from "@/lib/cmaUsage";

export async function POST(req: Request) {
  try {
    const usage = await getCmaUsage(req);
    return NextResponse.json({ ok: true, usage });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

