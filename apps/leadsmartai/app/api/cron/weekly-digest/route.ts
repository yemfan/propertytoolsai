import { NextResponse } from "next/server";
import { buildAllDigests } from "@/lib/digest/digestBuilder";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Weekly performance digest cron job.
 * Schedule: every Monday at 8am (Vercel cron or external scheduler).
 * Computes metrics for the previous Mon–Sun, generates insights, saves digest, sends push.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await buildAllDigests();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    console.error("weekly-digest cron error", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
