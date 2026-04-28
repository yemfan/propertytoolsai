import { NextResponse } from "next/server";
import { loadByShareToken } from "@/lib/video-messages/service";

/**
 * Public video-message read endpoint.
 *
 * GET /api/v/[token]
 *
 * Returns the redacted player metadata — no agent_id, no
 * contact_id, no view counters leak. The seller-facing player
 * page consumes this to render the `<video>` element.
 *
 * Token-only auth. Unpublished or unknown tokens collapse to
 * 404 to avoid token enumeration.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
  }

  const message = await loadByShareToken(token);
  if (!message) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    video: {
      title: message.title,
      videoUrl: message.videoUrl,
      thumbnailUrl: message.thumbnailUrl,
      durationSeconds: message.durationSeconds,
    },
  });
}
