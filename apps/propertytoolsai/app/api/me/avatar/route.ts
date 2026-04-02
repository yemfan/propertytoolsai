import { NextResponse } from "next/server";
import { resolveAvatarImageForUpload } from "@/lib/avatarUploadMime";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseAdmin, isSupabaseServiceConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

const AVATAR_BUCKET = "avatars";

/**
 * POST /api/me/avatar — multipart form field `file`. Uploads to Storage and saves `avatar_url` on `user_profiles`.
 */
export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseServiceConfigured()) {
    return NextResponse.json({ ok: false, error: "Server not configured" }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Expected multipart form data" }, { status: 400 });
  }

  const raw = formData.get("file");
  if (!raw || typeof raw === "string") {
    return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });
  }
  if (!(raw instanceof Blob)) {
    return NextResponse.json({ ok: false, error: "Invalid file" }, { status: 400 });
  }

  if (raw.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "File too large (max 5MB)" }, { status: 400 });
  }

  const ab = await raw.arrayBuffer();
  const buf = Buffer.from(ab);
  const fileLike: Pick<File, "type" | "name"> = {
    type: raw.type,
    name: raw instanceof File ? raw.name : "upload.bin",
  };
  const resolved = resolveAvatarImageForUpload(fileLike, ab);
  if (resolved.ok === false) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 400 });
  }

  const path = `${user.id}/profile-${Date.now()}.${resolved.ext}`;

  const { error: upErr } = await supabaseAdmin.storage.from(AVATAR_BUCKET).upload(path, buf, {
    contentType: resolved.contentType,
    upsert: true,
  });

  if (upErr) {
    return NextResponse.json(
      {
        ok: false,
        error: upErr.message,
        hint: 'Create a public Storage bucket named "avatars" in Supabase (Dashboard → Storage).',
      },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(AVATAR_BUCKET).getPublicUrl(path);

  const { data: rows, error: dbErr } = await supabaseAdmin
    .from("user_profiles")
    .update({ avatar_url: publicUrl } as never)
    .eq("user_id", user.id)
    .select("user_id");

  if (dbErr) {
    return NextResponse.json({ ok: false, error: dbErr.message }, { status: 500 });
  }

  if (!rows?.length) {
    const { error: insErr } = await supabaseAdmin.from("user_profiles").insert({
      user_id: user.id,
      role: "user",
      avatar_url: publicUrl,
    } as never);
    if (insErr) {
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, avatar_url: publicUrl });
}
