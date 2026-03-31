/**
 * Voice session language: English / Chinese (Simplified context for STT/TTS).
 * Detection is heuristic + explicit keywords — no external API required.
 */

export type VoiceSessionLanguage = "en" | "zh";

export type VoiceLanguageDetectionMethod =
  | "explicit"
  | "auto"
  | "default_en"
  | "unchanged"
  | "manual_switch";

export type VoiceSessionState = {
  /** Locked after first successful determination; may change only via explicit switch phrases. */
  language: VoiceSessionLanguage | null;
  /**
   * True after the bilingual greeting (single prompt asking EN/中文 preference) is played.
   * We never ask for language again in TwiML — only this one prompt.
   */
  preference_prompt_shown: boolean;
  locked_at?: string;
  last_detection_method?: VoiceLanguageDetectionMethod;
};

export function createInitialVoiceSessionState(): VoiceSessionState {
  return { language: null, preference_prompt_shown: true };
}

/** Restore session from `lead_calls.metadata.voice_session`. */
export function parseVoiceSession(raw: unknown): VoiceSessionState {
  if (!raw || typeof raw !== "object") return createInitialVoiceSessionState();
  const o = raw as Record<string, unknown>;
  const lang = o.language;
  const language: VoiceSessionLanguage | null =
    lang === "en" || lang === "zh" ? lang : null;
  const m = o.last_detection_method;
  const method =
    m === "explicit" ||
    m === "auto" ||
    m === "default_en" ||
    m === "unchanged" ||
    m === "manual_switch"
      ? m
      : undefined;
  return {
    language,
    preference_prompt_shown: o.preference_prompt_shown !== false,
    locked_at: typeof o.locked_at === "string" ? o.locked_at : undefined,
    last_detection_method: method,
  };
}

function stripNoise(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Ratio of CJK characters in non-whitespace string (0–1). */
export function cjkRatio(text: string): number {
  const chars = text.replace(/\s/g, "");
  if (!chars.length) return 0;
  let cjk = 0;
  for (const ch of chars) {
    if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) cjk++;
  }
  return cjk / chars.length;
}

/** User explicitly names a language (short answers: "English", "中文"). */
export function parseExplicitLanguagePreference(text: string): VoiceSessionLanguage | null {
  const t = stripNoise(text);
  if (!t) return null;
  const lower = t.toLowerCase();
  const hasZhWord =
    /(?:^|[\s,，.])(中文|国语|汉语|普通话)(?:$|[\s,，.])/u.test(t) ||
    /chinese|mandarin|cantonese/i.test(lower);
  const hasEnWord =
    /(?:^|[\s,，.])(english|eng\.?)(?:$|[\s,，.])/i.test(lower) || /\benglish\b/i.test(lower);
  if (hasEnWord && !hasZhWord) return "en";
  if (hasZhWord && !hasEnWord) return "zh";
  if (/^英/.test(t) && t.length <= 6) return "en";
  if (/^中/.test(t) && t.length <= 6) return "zh";
  return null;
}

/** Mid-call language switch (does not re-ask preference; flips locked language). */
export function parseLanguageSwitchRequest(text: string): VoiceSessionLanguage | null {
  const t = stripNoise(text).toLowerCase();
  if (
    /switch\s+to\s+(chinese|mandarin)|change\s+to\s+(chinese|mandarin)|说中文|用中文|改中文|切换中文|要中文/.test(
      t
    ) ||
    /^(中文|国语)$/.test(stripNoise(text))
  ) {
    return "zh";
  }
  if (
    /switch\s+to\s+english|change\s+to\s+english|说英文|用英文|改英文|切换英文|english\s+please/.test(t) ||
    /^english$/i.test(stripNoise(text))
  ) {
    return "en";
  }
  return null;
}

/**
 * Infer language from transcript when user speaks naturally without naming a language.
 */
export function inferLanguageFromText(text: string): VoiceSessionLanguage | null {
  const t = stripNoise(text);
  if (!t) return null;
  const ratio = cjkRatio(t);
  if (ratio >= 0.2) return "zh";
  if (ratio < 0.06 && /[a-zA-Z]{2,}/.test(t)) return "en";
  if (ratio >= 0.06 && ratio < 0.2) return "zh";
  return null;
}

export type ResolveVoiceLanguageResult = {
  language: VoiceSessionLanguage;
  method: VoiceLanguageDetectionMethod;
  nextSession: VoiceSessionState;
};

/**
 * Single speech turn: lock language without re-asking later.
 * - If session already has a language and no switch request → unchanged.
 * - Else explicit > auto > default (en).
 */
export function resolveVoiceSessionLanguage(
  speechText: string,
  session: VoiceSessionState | null | undefined
): ResolveVoiceLanguageResult {
  const prev = session ?? createInitialVoiceSessionState();
  const raw = stripNoise(speechText);

  const switchTo = parseLanguageSwitchRequest(raw);
  if (switchTo && (!prev.language || switchTo !== prev.language)) {
    const next: VoiceSessionState = {
      ...prev,
      language: switchTo,
      locked_at: new Date().toISOString(),
      last_detection_method: prev.language ? "manual_switch" : "explicit",
    };
    return {
      language: switchTo,
      method: prev.language ? "manual_switch" : "explicit",
      nextSession: next,
    };
  }

  if (prev.language) {
    return {
      language: prev.language,
      method: "unchanged",
      nextSession: prev,
    };
  }

  const explicit = parseExplicitLanguagePreference(raw);
  if (explicit) {
    const next: VoiceSessionState = {
      ...prev,
      language: explicit,
      locked_at: new Date().toISOString(),
      last_detection_method: "explicit",
    };
    return { language: explicit, method: "explicit", nextSession: next };
  }

  const inferred = inferLanguageFromText(raw);
  if (inferred) {
    const next: VoiceSessionState = {
      ...prev,
      language: inferred,
      locked_at: new Date().toISOString(),
      last_detection_method: "auto",
    };
    return { language: inferred, method: "auto", nextSession: next };
  }

  const next: VoiceSessionState = {
    ...prev,
    language: "en",
    locked_at: new Date().toISOString(),
    last_detection_method: "default_en",
  };
  return { language: "en", method: "default_en", nextSession: next };
}
