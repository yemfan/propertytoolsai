import type { AgentVoiceSettings } from "./types";

/**
 * Clone is eligible to drive provider TTS / future `<Play>` when consent, ready remote id,
 * preview review, and activation flag are all satisfied.
 */
export function isClonedVoiceActiveForCalls(settings: AgentVoiceSettings): boolean {
  return (
    settings.consentConfirmed === true &&
    settings.useClonedVoice === true &&
    settings.voiceCloneStatus === "ready" &&
    Boolean(settings.voiceCloneRemoteId?.trim()) &&
    Boolean(settings.voiceClonePreviewAcknowledgedAt)
  );
}

/**
 * Twilio `<Say>` always uses Polly presets today; this signals when clone metadata is live for downstream TTS.
 */
export function resolveVoicePlaybackSource(settings: AgentVoiceSettings): "preset" | "clone_configured_not_wired" {
  if (isClonedVoiceActiveForCalls(settings)) {
    return "clone_configured_not_wired";
  }
  return "preset";
}

export function canUploadVoiceCloneSample(settings: AgentVoiceSettings): boolean {
  return settings.consentConfirmed === true;
}

export function canActivateClonedVoice(settings: AgentVoiceSettings): boolean {
  return (
    settings.consentConfirmed &&
    settings.voiceCloneStatus === "ready" &&
    Boolean(settings.voiceCloneRemoteId?.trim()) &&
    Boolean(settings.voiceClonePreviewAcknowledgedAt) &&
    !settings.useClonedVoice
  );
}
