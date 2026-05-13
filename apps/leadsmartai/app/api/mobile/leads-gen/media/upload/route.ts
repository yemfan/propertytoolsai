import { NextResponse } from "next/server";

import { uploadMedia, type MediaKind } from "@/lib/leads-gen/media";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
// Photos from a phone can be 5-20 MB; storage round-trip alone
// takes a few seconds on a slow connection. Generous timeout.
export const maxDuration = 120;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

const MAX_BYTES = 20 * 1024 * 1024;

/**
 * POST /api/mobile/leads-gen/media/upload
 *
 * Mobile-side counterpart to /api/leads-gen/media/upload. Multipart
 * form with `file` (required image) + optional `kind` + `label`.
 *
 * Returns the created MediaItem (`id`, `signedUrl`, etc.). Mobile
 * Quick Post stashes the `id` and references it in the publish
 * payload so the shared `publishPost` helper can pull bytes back
 * out of storage (LinkedIn) or hand Meta the signed URL (FB / IG).
 *
 * Plan gate: Pro+ (mirrors web).
 *
 * Auth: Bearer (same as the rest of /api/mobile/*).
 */
export async function POST(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const { data: agentRow } = await supabaseAdmin
      .from("agents")
      .select("plan_type")
      .eq("id", auth.ctx.agentId)
      .maybeSingle();
    const planType = (
      (agentRow as { plan_type: string | null } | null)?.plan_type ?? "free"
    ).toLowerCase();
    if (planType === "free") {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: "Media library requires Pro or higher.",
        },
        { status: 402 },
      );
    }

    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json(
        { ok: false, success: false, error: "Expected multipart form upload" },
        { status: 400 },
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { ok: false, success: false, error: "Missing file field" },
        { status: 400 },
      );
    }
    if (file.size === 0) {
      return NextResponse.json(
        { ok: false, success: false, error: "File is empty" },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, success: false, error: "File too large (max 20 MB)" },
        { status: 400 },
      );
    }

    const mime = (file.type || "").toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
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
      agentId: auth.ctx.agentId,
      bytes,
      fileName: file.name || `${Date.now()}.jpg`,
      contentType: mime,
      kind,
      label,
    });

    return NextResponse.json({ ok: true, success: true, item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    console.error("[mobile/leads-gen/media/upload]", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}
