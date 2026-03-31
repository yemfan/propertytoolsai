import type { VoiceCallIntent } from "./types";

/** Heuristic one-line summary when the LLM is unavailable. */
export function createCallSummary(params: {
  transcript: string;
  inferredIntent: VoiceCallIntent;
  hotLead: boolean;
  needsHuman: boolean;
}): string {
  const t = params.transcript.trim().slice(0, 500);
  const flags = [params.hotLead ? "hot" : null, params.needsHuman ? "needs human" : null]
    .filter(Boolean)
    .join(", ");
  const intent =
    params.inferredIntent !== "unknown" ? ` Intent: ${params.inferredIntent}.` : "";
  const head = flags ? `[${flags}] ` : "";
  return `${head}Caller said: ${t || "(no speech)"}.${intent}`.trim();
}
