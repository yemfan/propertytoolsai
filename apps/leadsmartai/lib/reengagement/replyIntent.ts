import type { ReplyIntent } from "./types";

/** Lightweight inbound SMS keyword routing for automation hooks (not legal advice). */
export function handleLeadReply(message: string): ReplyIntent {
  const text = message.toLowerCase();

  if (/\b(stop|unsubscribe|cancel|end)\b/.test(text)) {
    return "opt_out";
  }

  if (
    /\b(yes|yeah|yep|interested|sure|call me|let'?s talk|schedule|book)\b/.test(text)
  ) {
    return "hot";
  }

  return "neutral";
}
