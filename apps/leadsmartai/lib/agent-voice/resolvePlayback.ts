import type { AgentVoiceSettings, TwilioVoicePlayback, VoiceSpeakingStyle } from "./types";
import { findPreset } from "./presets";

const DEFAULT_PLAYBACK: TwilioVoicePlayback = {
  voiceEn: "Polly.Joanna",
  voiceZh: "Polly.Zhiyu",
  bilingualEnabled: true,
  defaultLanguage: "en",
};

function speakingStyleToRate(style: VoiceSpeakingStyle): string | undefined {
  if (style === "friendly") return undefined;
  if (style === "professional") return "95%";
  return "88%";
}

/**
 * Maps saved agent voice settings to Twilio `<Say>` playback. OpenAI/ElevenLabs providers
 * use preset metadata; actual OpenAI/ElevenLabs audio generation is a future step.
 */
export function resolveTwilioVoicePlayback(settings: AgentVoiceSettings): TwilioVoicePlayback {
  const preset = findPreset(settings.provider, settings.presetVoiceId);
  const voiceEn = preset?.twilioVoiceEn ?? DEFAULT_PLAYBACK.voiceEn;
  const voiceZh = preset?.twilioVoiceZh ?? DEFAULT_PLAYBACK.voiceZh;
  const ratePercent = speakingStyleToRate(settings.speakingStyle);

  const bilingualEnabled = settings.bilingualEnabled;
  const defaultLanguage = settings.defaultLanguage;

  return {
    voiceEn,
    voiceZh,
    bilingualEnabled,
    defaultLanguage,
    ...(ratePercent ? { ratePercent } : {}),
  };
}

export function defaultTwilioVoicePlayback(): TwilioVoicePlayback {
  return { ...DEFAULT_PLAYBACK };
}
