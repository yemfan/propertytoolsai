// Real-estate SMS intent classification now lives in @helm/pack-real-estate
// (Real Estate Industry Pack). The RE intent taxonomy is industry-specific, so it is
// NOT in Core (@helm/dna-communication holds only the channel-agnostic safety layer).
// Behavior-preserving re-export.
export { inferIntentHeuristic } from "@helm/pack-real-estate";
