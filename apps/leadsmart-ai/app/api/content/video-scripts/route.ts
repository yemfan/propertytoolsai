import { NextResponse } from "next/server";
import { generateVideoScripts } from "@/lib/videoScriptsAI";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      city?: string;
      audience?: "seller" | "buyer" | "investor" | "general";
      topic?: string;
    };

    const scripts = await generateVideoScripts({
      city: body.city,
      audience: body.audience,
      topic: body.topic,
    });

    return NextResponse.json({ ok: true, scripts });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}

