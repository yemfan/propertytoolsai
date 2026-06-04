"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Upload a profile picture to the "avatars" bucket (under the user's own folder) and
 * save its public URL to auth metadata (`avatar_url`), which the sidebar avatar reads.
 * Return type is inferred by the caller's useActionState — a "use server" module may
 * only export async functions, so no exported state type.
 */
export async function uploadAvatar(
  _: { error: string } | { ok: true; url: string } | null,
  formData: FormData
): Promise<{ error: string } | { ok: true; url: string } | null> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image first." };
  if (!file.type.startsWith("image/")) return { error: "That file isn't an image." };
  if (file.size > 2 * 1024 * 1024) return { error: "Image must be under 2 MB." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You're not signed in." };

  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${user.id}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (upErr) return { error: upErr.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error: metaErr } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
  if (metaErr) return { error: metaErr.message };

  revalidatePath("/", "layout"); // refresh the sidebar avatar
  return { ok: true, url: publicUrl };
}
