import type { VoicePresetOption, VoiceProvider } from "./types";

/** OpenAI-named presets; Twilio uses Amazon Polly stand-ins until Realtime/native TTS is wired. */
export const OPENAI_VOICE_PRESETS: VoicePresetOption[] = [
  {
    id: "openai_alloy",
    label: "Alloy",
    description: "Neutral, balanced (maps to Polly Joanna / Zhiyu on Twilio today).",
    twilioVoiceEn: "Polly.Joanna",
    twilioVoiceZh: "Polly.Zhiyu",
    openaiVoiceId: "alloy",
    elevenLabsVoiceId: "",
  },
  {
    id: "openai_echo",
    label: "Echo",
    description: "Warm male (Polly Matthew / Zhiyu).",
    twilioVoiceEn: "Polly.Matthew",
    twilioVoiceZh: "Polly.Zhiyu",
    openaiVoiceId: "echo",
    elevenLabsVoiceId: "",
  },
  {
    id: "openai_fable",
    label: "Fable",
    description: "Expressive British-leaning (Polly Amy / Zhiyu).",
    twilioVoiceEn: "Polly.Amy",
    twilioVoiceZh: "Polly.Zhiyu",
    openaiVoiceId: "fable",
    elevenLabsVoiceId: "",
  },
  {
    id: "openai_onyx",
    label: "Onyx",
    description: "Deep male (Polly Joey / Zhiyu).",
    twilioVoiceEn: "Polly.Joey",
    twilioVoiceZh: "Polly.Zhiyu",
    openaiVoiceId: "onyx",
    elevenLabsVoiceId: "",
  },
  {
    id: "openai_nova",
    label: "Nova",
    description: "Bright female (Polly Salli / Zhiyu).",
    twilioVoiceEn: "Polly.Salli",
    twilioVoiceZh: "Polly.Zhiyu",
    openaiVoiceId: "nova",
    elevenLabsVoiceId: "",
  },
  {
    id: "openai_shimmer",
    label: "Shimmer",
    description: "Soft female (Polly Kimberly / Zhiyu).",
    twilioVoiceEn: "Polly.Kimberly",
    twilioVoiceZh: "Polly.Zhiyu",
    openaiVoiceId: "shimmer",
    elevenLabsVoiceId: "",
  },
];

/** ElevenLabs-style presets; Polly mapping is approximate until ElevenLabs audio is integrated. */
export const ELEVENLABS_VOICE_PRESETS: VoicePresetOption[] = [
  {
    id: "elevenlabs_rachel",
    label: "Rachel",
    description: "Calm, narrative (Joanna / Zhiyu on Twilio today).",
    twilioVoiceEn: "Polly.Joanna",
    twilioVoiceZh: "Polly.Zhiyu",
    openaiVoiceId: "alloy",
    elevenLabsVoiceId: "21m00Tcm4TlvDq8ikWAM",
  },
  {
    id: "elevenlabs_domi",
    label: "Domi",
    description: "Strong, confident (Salli / Zhiyu).",
    twilioVoiceEn: "Polly.Salli",
    twilioVoiceZh: "Polly.Zhiyu",
    openaiVoiceId: "nova",
    elevenLabsVoiceId: "AZnzlk1XvdvUeBnXmlld",
  },
  {
    id: "elevenlabs_bella",
    label: "Bella",
    description: "Soft female (Kimberly / Zhiyu).",
    twilioVoiceEn: "Polly.Kimberly",
    twilioVoiceZh: "Polly.Zhiyu",
    openaiVoiceId: "shimmer",
    elevenLabsVoiceId: "EXAVITQu4vr4xnSDxMaL",
  },
  {
    id: "elevenlabs_antoni",
    label: "Antoni",
    description: "Well-rounded male (Joey / Zhiyu).",
    twilioVoiceEn: "Polly.Joey",
    twilioVoiceZh: "Polly.Zhiyu",
    openaiVoiceId: "onyx",
    elevenLabsVoiceId: "ErXwobaYiN019PkySvjV",
  },
  {
    id: "elevenlabs_elli",
    label: "Elli",
    description: "Emotional female (Amy / Zhiyu).",
    twilioVoiceEn: "Polly.Amy",
    twilioVoiceZh: "Polly.Zhiyu",
    openaiVoiceId: "fable",
    elevenLabsVoiceId: "MF3mGyEYCl7XYWbV9V6O",
  },
  {
    id: "elevenlabs_josh",
    label: "Josh",
    description: "Young male (Matthew / Zhiyu).",
    twilioVoiceEn: "Polly.Matthew",
    twilioVoiceZh: "Polly.Zhiyu",
    openaiVoiceId: "echo",
    elevenLabsVoiceId: "TxGEqnHWrfWFTfGW9XjX",
  },
];

export function listPresetsForProvider(provider: VoiceProvider): VoicePresetOption[] {
  return provider === "elevenlabs" ? ELEVENLABS_VOICE_PRESETS : OPENAI_VOICE_PRESETS;
}

export function findPreset(provider: VoiceProvider, presetId: string): VoicePresetOption | null {
  const list = listPresetsForProvider(provider);
  return list.find((p) => p.id === presetId) ?? null;
}
