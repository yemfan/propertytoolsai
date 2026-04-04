import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAvatarImageForUpload } from "@/lib/avatarUploadMime";

const MAX_BYTES = 5 * 1024 * 1024;
const BUCKET = "avatars";

/**
 * Upload profile photo using the **browser Supabase client** (user JWT), then set `user_profiles.avatar_url`.
 * Does not require `SUPABASE_SERVICE_ROLE_KEY` on the API.
 */
export async function uploadProfilePhotoWithSessionClient(
  supabase: SupabaseClient,
  file: File
): Promise<{ ok: true; publicUrl: string } | { ok: false; error: string }> {
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "File too large (max 5MB)" };
  }

  const ab = await file.arrayBuffer();
  const resolved = resolveAvatarImageForUpload(file, ab);
  if (resolved.ok === false) return { ok: false, error: resolved.error };

  const {
    data: { user },
    error: uErr,
  } = await supabase.auth.getUser();
  if (uErr || !user) return { ok: false, error: "Sign in required." };

  const path = `${user.id}/profile-${Date.now()}.${resolved.ext}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: resolved.contentType,
    upsert: true,
  });
  if (upErr) {
    const msg = upErr.message;
    if (/row-level security|rls|policy/i.test(msg)) {
      return {
        ok: false,
        error: `${msg} Run the latest Supabase migration that adds storage policies for the "avatars" bucket.`,
      };
    }
    return { ok: false, error: msg };
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  const { data: rows, error: dbErr } = await supabase
    .from("user_profiles")
    .update({ avatar_url: publicUrl })
    .eq("user_id", user.id)
    .select("user_id");

  if (dbErr) return { ok: false, error: dbErr.message };

  if (!rows?.length) {
    const { error: insErr } = await supabase.from("user_profiles").insert({
      user_id: user.id,
      avatar_url: publicUrl,
    } as never);
    if (insErr) return { ok: false, error: insErr.message };
  }

  return { ok: true, publicUrl };
}
