import { generateReply, type GenerateReplyContext, type ReplyMessage } from "@/lib/aiReplyGenerator";

export type LeadForAutoReply = {
  id?: string;
  name?: string | null;
  property_address?: string | null;
  search_location?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  intent?: string | null;
  rating?: string | null;
  source?: string | null;
  lead_status?: string | null;
};

/**
 * First-touch AI reply using location, price range, and CRM/behavior fields.
 */
export async function generateInitialReply(
  lead: LeadForAutoReply,
  options?: { messages?: ReplyMessage[]; preferences?: Record<string, unknown> }
): Promise<string> {
  const ctx: GenerateReplyContext = {
    lead,
    messages: options?.messages ?? [],
    preferences: options?.preferences ?? {},
    task: "initial outreach to a new or re-engaged lead",
  };
  return generateReply(ctx);
}
