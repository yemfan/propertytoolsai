import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
// Phone photos can be several MB; give the storage round-trip room.
export const maxDuration = 120;

const RECEIPTS_BUCKET = "receipts";
const MAX_BYTES = 15 * 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

/**
 * POST /api/mobile/expenses/receipt — multipart upload of a receipt
 * photo for the authenticated agent. Stores it in the public
 * `receipts` bucket via the service-role client (bypasses storage
 * RLS) and returns a stable public URL the client attaches to the
 * expense as `receiptUrl`.
 */
export async function POST(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json(
        { ok: false, success: false, error: "Expected multipart form upload" },
        { status: 400 },
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { ok: false, success: false, error: "Missing file" },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, success: false, error: "Receipt is too large (max 15MB)." },
        { status: 400 },
      );
    }

    const mime = (file.type || "image/jpeg").toLowerCase();
    const ext = EXT_BY_MIME[mime] ?? "jpg";
    const path = `${auth.ctx.agentId}/${randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: upErr } = await supabaseAdmin.storage
      .from(RECEIPTS_BUCKET)
      .upload(path, bytes, { contentType: mime, upsert: false, cacheControl: "3600" });
    if (upErr) {
      const msg = upErr.message;
      // Bucket missing? The repo migration that creates the public
      // `receipts` bucket hasn't been applied yet — surface clearly.
      const hint = /bucket|not found/i.test(msg)
        ? `${msg} (apply the migration that creates the "receipts" storage bucket)`
        : msg;
      console.error("mobile/expenses/receipt upload", msg);
      return NextResponse.json({ ok: false, success: false, error: hint }, { status: 500 });
    }

    const { data: pub } = supabaseAdmin.storage.from(RECEIPTS_BUCKET).getPublicUrl(path);
    return NextResponse.json({ ok: true, success: true, url: pub.publicUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/mobile/expenses/receipt", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}
