import { NextResponse } from "next/server";
import { executeActivePlans } from "@/lib/marketing/planExecutor";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Daily marketing plan executor cron.
 * Runs all due steps for active plans.
 * Schedule: daily (e.g. 9am via Vercel cron or external scheduler).
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
    const result = await executeActivePlans();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    console.error("marketing-plans cron error", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
