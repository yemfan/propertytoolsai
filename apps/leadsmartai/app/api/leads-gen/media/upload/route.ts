import { NextResponse } from "next/server";

import { getDashboardAgentContext } from "@/lib/contact-intake/dashboardAgentContext";
import { uploadMedia, type MediaKind } from "@/lib/leads-gen/media";

export const runtime = "nodejs";
// Image uploads from a phone can be 5-20 MB; the storage round-trip
// alone takes a few seconds on a slow connection. Generous timeout
// keeps the wizard from showing an error on a still-uploading file.
export const maxDuration = 120;

/** Mirrors the bucket's MIME allowlist — kept in sync manually with
 *  the SQL migration (`20260625000000_lead_media_library.sql`). */
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

/** Mirrors the bucket's file_size_limit. */
const MAX_BYTES = 20 * 1024 * 1024;

/**
 * POST /api/leads-gen/media/upload
 *
 * Multipart form with:
 *   file   — required, image binary
 *   kind   — optional, MediaKind enum (defaults "general")
 *   label  — optional, agent-supplied caption / alt text
 *
 * Returns the created `MediaItem` shape (id, signed URL, kind, ...).
 * The signed URL is good for 1h — the wizard caches it for that
 * window, then re-lists if the agent revisits.
 *
 * Plan gate: Pro or higher.
 */
export async function POST(req: Request) {
  try {
    const auth = await getDashboardAgentContext();
    if (auth.ok === false) return auth.response;

    if (auth.planType === "free") {
      return NextResponse.json(
        { ok: false, error: "Media library requires Pro or higher." },
        { status: 402 },
      );
    }

    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json(
        { ok: false, error: "Expected multipart form upload" },
        { status: 400 },
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Missing file field" },
        { status: 400 },
      );
    }
    if (file.size === 0) {
      return NextResponse.json(
        { ok: false, error: "File is empty" },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: "File too large (max 20 MB)" },
        { status: 400 },
      );
    }

    const mime = (file.type || "").toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Unsupported image type. Use JPEG, PNG, WEBP, GIF, or HEIC/HEIF.",
        },
        { status: 400 },
      );
    }

    const kindRaw = (form.get("kind") as string | null)?.trim() ?? "";
    const kind: MediaKind =
      kindRaw === "general" ||
      kindRaw === "listing_photo" ||
      kindRaw === "agent_headshot" ||
      kindRaw === "agent_logo" ||
      kindRaw === "market_chart" ||
      kindRaw === "testimonial_quote"
        ? (kindRaw as MediaKind)
        : "general";

    const labelRaw = (form.get("label") as string | null)?.trim() ?? "";
    const label = labelRaw.slice(0, 240) || null;

    const bytes = new Uint8Array(await file.arrayBuffer());
    const item = await uploadMedia({
      agentId: auth.agentId,
      bytes,
      fileName: file.name || `${Date.now()}.jpg`,
      contentType: mime,
      kind,
      label,
    });

    return NextResponse.json({ ok: true, item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    console.error("[leads-gen/media/upload]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
