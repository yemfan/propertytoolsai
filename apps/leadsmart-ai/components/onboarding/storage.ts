import type { OnboardingPersisted, OnboardingStep } from "./types";

const KEY = "leadsmart_onboarding_v1";

const defaultState = (): OnboardingPersisted => ({
  version: 1,
  step: 1,
  profile: {},
  selectedLeadId: null,
  hasReplied: false,
  paywallSeen: false,
  engagementPoints: 0,
  completedAt: null,
});

export function loadOnboarding(): OnboardingPersisted {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as OnboardingPersisted;
    if (parsed?.version !== 1) return defaultState();
    return { ...defaultState(), ...parsed, profile: { ...defaultState().profile, ...parsed.profile } };
  } catch {
    return defaultState();
  }
}

export function saveOnboarding(state: OnboardingPersisted) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

export function clearOnboarding() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function stepToProgress(step: OnboardingStep): number {
  return Math.round((step / 8) * 100);
}
