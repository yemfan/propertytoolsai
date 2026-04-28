import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { recordView } from "@/lib/video-messages/service";

/**
 * Player heartbeat endpoint. The viewer's `<video>` element
 * pings this every few seconds with the current `currentTime`,
 * and again on `ended` / `pagehide`. Server logs the view +
 * bumps the parent row's counters when the watch is real.
 *
 * Idempotent in the sense that calling it many times in one
 * play session is fine — view_count will only bump once because
 * the per-IP unique check + the high-water-mark watch_pct logic
 * collapse them. (Today the simpler model just inserts a row
 * per heartbeat and lets aggregate queries dedupe.)
 *
 * Always 200s on bad input — the viewer page shouldn't crash
 * the player UI if a heartbeat is rejected.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let payload: { watchedSeconds?: number };
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" });
  }

  const watchedSeconds = Number(payload.watchedSeconds);
  if (!Number.isFinite(watchedSeconds) || watchedSeconds < 0) {
    return NextResponse.json({ ok: false, error: "bad_watched_seconds" });
  }

  const h = await headers();
  const viewerIp =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;
  const userAgent = h.get("user-agent") ?? null;

  const result = await recordView({
    rawToken: token,
    watchedSeconds,
    viewerIp,
    userAgent,
  });

  return NextResponse.json(result);
}
