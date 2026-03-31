/**
 * Provider integration point for voice cloning. Implementations return a remote voice id for storage in
 * `agent_voice_settings.voice_clone_remote_id`.
 */

export type CloneProviderId = "elevenlabs";

export type SubmitVoiceCloneResult = {
  remoteVoiceId: string;
  /** Optional preview bytes to store as preview audio in Supabase Storage. */
  previewAudioMp3?: Buffer;
};

export type VoiceCloneProviderAdapter = {
  id: CloneProviderId;
  /** Create a voice from sample audio; throws on HTTP/provider errors. */
  submitFromSample(params: {
    agentId: string;
    filename: string;
    bytes: Buffer;
    mimeType: string;
  }): Promise<SubmitVoiceCloneResult>;
};

const ELEVENLABS_VOICES_URL = "https://api.elevenlabs.io/v1/voices/add";

async function elevenLabsSubmit(params: {
  agentId: string;
  filename: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<SubmitVoiceCloneResult> {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }

  const form = new FormData();
  form.append("name", `LeadSmart AI-${params.agentId.slice(0, 8)}`);
  form.append("description", "LeadSmart AI agent voice clone");
  const ext =
    params.filename.toLowerCase().endsWith(".wav") || params.mimeType.includes("wav")
      ? "wav"
      : params.filename.toLowerCase().endsWith(".webm") || params.mimeType.includes("webm")
        ? "webm"
        : "mp3";
  const blob = new Blob([new Uint8Array(params.bytes)], { type: params.mimeType || "audio/mpeg" });
  form.append("files", blob, `sample.${ext}`);

  const res = await fetch(ELEVENLABS_VOICES_URL, {
    method: "POST",
    headers: {
      "xi-api-key": key,
    },
    body: form,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`ElevenLabs voice create failed (${res.status}): ${text.slice(0, 500)}`);
  }

  let voiceId = "";
  try {
    const json = JSON.parse(text) as { voice_id?: string };
    voiceId = (json.voice_id || "").trim();
  } catch {
    throw new Error("ElevenLabs returned non-JSON response");
  }
  if (!voiceId) {
    throw new Error("ElevenLabs response missing voice_id");
  }

  return { remoteVoiceId: voiceId };
}

export function getVoiceCloneAdapter(provider: CloneProviderId | null | undefined): VoiceCloneProviderAdapter | null {
  if (provider === "elevenlabs") {
    return {
      id: "elevenlabs",
      submitFromSample: elevenLabsSubmit,
    };
  }
  return null;
}
