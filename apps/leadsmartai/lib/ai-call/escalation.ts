// Channel-agnostic human-escalation now lives in @helm/dna-communication (Communication DNA).
// Behavior-preserving re-export. The RE-specific hot-lead/intent logic that composes this
// lives in @helm/pack-real-estate.
export { needsHumanFromText } from "@helm/dna-communication";
