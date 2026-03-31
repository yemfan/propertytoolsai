import type { VoiceCallIntent, VoiceIntentRole } from "./types";

/** Replace at deploy time for Slack / internal webhooks. */
export const voiceHooks: {
  onCallProcessed: (ctx: {
    callId: string;
    twilioCallSid: string;
    leadId: string;
    agentId: string | null;
    intent: VoiceCallIntent;
    hotLead: boolean;
    needsHuman: boolean;
    intentRole: VoiceIntentRole;
    summary: string;
    analysisSource: "openai" | "heuristic";
  }) => Promise<void>;
} = {
  async onCallProcessed() {},
};
