import { NextResponse } from "next/server";
import { recordGoogleClick } from "@/lib/reviews/service";

/**
 * Public Google-click tracking endpoint. The landing page hits
 * this (fire-and-forget) when the visitor clicks "Leave a Google
 * review" so the agent can see who clicked through vs. submitted
 * privately.
 *
 * Idempotent — re-clicks don't bump the timestamp.
 */
export async function POST(req: Request) {
  let payload: { token?: string };
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const token = (payload.token ?? "").trim();
  if (!token) return NextResponse.json({ ok: false }, { status: 400 });

  const ok = await recordGoogleClick(token);
  return NextResponse.json({ ok });
}
