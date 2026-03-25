import { NextResponse } from "next/server";
import { findPropertyMatches, parseMatchPreferences } from "@/lib/match/findMatches";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => null);
    const prefs = parseMatchPreferences(raw);
    if (!prefs) {
      return NextResponse.json(
        { success: false, error: "Invalid body: need a positive numeric budget" },
        { status: 400 }
      );
    }

    const { matches, provider } = await findPropertyMatches(prefs);

    return NextResponse.json({
      success: true,
      preferences: prefs,
      provider,
      matches,
    });
  } catch (error) {
    console.error("POST /api/match", error);
    return NextResponse.json(
      { success: false, error: "Failed to compute matches" },
      { status: 500 }
    );
  }
}
