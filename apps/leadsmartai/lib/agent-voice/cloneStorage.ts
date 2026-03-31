import { supabaseAdmin } from "@/lib/supabase/admin";

export const VOICE_CLONE_BUCKET = "agent-voice-clones";

export async function uploadVoiceCloneSampleObject(params: {
  agentId: string;
  bytes: Buffer;
  contentType: string;
  extension: string;
}): Promise<{ path: string }> {
  const safeExt = params.extension.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
  const path = `${params.agentId}/${crypto.randomUUID()}.${safeExt}`;

  const { error } = await supabaseAdmin.storage.from(VOICE_CLONE_BUCKET).upload(path, params.bytes, {
    contentType: params.contentType,
    upsert: false,
  });

  if (error) throw error;
  return { path };
}

export async function uploadVoiceClonePreviewObject(params: {
  agentId: string;
  bytes: Buffer;
  extension: string;
}): Promise<{ path: string }> {
  const path = `${params.agentId}/preview-${crypto.randomUUID()}.${params.extension.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "mp3"}`;
  const { error } = await supabaseAdmin.storage.from(VOICE_CLONE_BUCKET).upload(path, params.bytes, {
    contentType: "audio/mpeg",
    upsert: false,
  });
  if (error) throw error;
  return { path };
}

export async function createSignedVoiceCloneUrl(storagePath: string, expiresIn = 3600): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(VOICE_CLONE_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function removeStorageObjectAtPath(storagePath: string): Promise<void> {
  const { error } = await supabaseAdmin.storage.from(VOICE_CLONE_BUCKET).remove([storagePath]);
  if (error) throw error;
}
