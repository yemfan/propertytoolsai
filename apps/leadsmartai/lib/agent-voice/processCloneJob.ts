import { supabaseAdmin } from "@/lib/supabase/admin";
import { getVoiceCloneAdapter } from "./cloneProvider";
import { VOICE_CLONE_BUCKET } from "./cloneStorage";
import { patchVoiceCloneFields } from "./settings";

/**
 * Downloads the uploaded sample and submits to the configured clone provider.
 * Idempotent: caller should set status to `processing` before await.
 */
export async function processVoiceCloneJob(agentId: string): Promise<void> {
  const { data: row, error: rowErr } = await supabaseAdmin
    .from("agent_voice_settings")
    .select("voice_clone_sample_storage_path, voice_clone_provider")
    .eq("agent_id", agentId as never)
    .maybeSingle();

  if (rowErr || !row) {
    await patchVoiceCloneFields(agentId, {
      voiceCloneStatus: "failed",
      voiceCloneError: "Missing agent_voice_settings row",
    });
    return;
  }

  const r = row as {
    voice_clone_sample_storage_path: string | null;
    voice_clone_provider: string | null;
  };

  const path = r.voice_clone_sample_storage_path?.trim();
  if (!path) {
    await patchVoiceCloneFields(agentId, {
      voiceCloneStatus: "failed",
      voiceCloneError: "No sample file path",
    });
    return;
  }

  const providerId = (r.voice_clone_provider?.trim() || "elevenlabs") as "elevenlabs";
  const adapter = getVoiceCloneAdapter(providerId);
  if (!adapter) {
    await patchVoiceCloneFields(agentId, {
      voiceCloneStatus: "failed",
      voiceCloneError: "Voice clone provider not supported",
    });
    return;
  }

  const { data: fileData, error: dlErr } = await supabaseAdmin.storage.from(VOICE_CLONE_BUCKET).download(path);
  if (dlErr || !fileData) {
    await patchVoiceCloneFields(agentId, {
      voiceCloneStatus: "failed",
      voiceCloneError: dlErr?.message || "Could not read sample from storage",
    });
    return;
  }

  const buf = Buffer.from(await fileData.arrayBuffer());
  const filename = path.split("/").pop() || "sample.mp3";
  const mimeType = fileData.type || "audio/mpeg";

  try {
    const result = await adapter.submitFromSample({
      agentId,
      filename,
      bytes: buf,
      mimeType,
    });

    await patchVoiceCloneFields(agentId, {
      voiceCloneStatus: "ready",
      voiceCloneRemoteId: result.remoteVoiceId,
      voiceCloneError: null,
      useClonedVoice: false,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Clone job failed";
    await patchVoiceCloneFields(agentId, {
      voiceCloneStatus: "failed",
      voiceCloneError: msg.slice(0, 2000),
    });
  }
}
