/**
 * "First-inbound auto-detect" — bumps a contact's `preferred_language`
 * based on the language of an incoming message, but only when no
 * explicit preference has been set yet.
 *
 * Called from:
 *   * apps/leadsmartai/app/api/sms/webhook/route.ts (Twilio inbound SMS)
 *   * apps/leadsmartai/app/api/ai-email/process-inbound/route.ts
 *
 * Semantics:
 *   * Reads `contacts.preferred_language`. If NULL, classifies the
 *     inbound text and writes the detected value.
 *   * If already set (even to 'en'), we do NOT overwrite. An explicit
 *     choice by the agent or a prior inbound message is authoritative;
 *     surprise-swapping languages mid-thread is worse than staying
 *     consistent.
 *   * Only flips when the detected language is NOT already the agent's
 *     default — if the detected language is 'en' and that's also the
 *     canonical default, writing `'en'` vs leaving NULL is semantically
 *     equivalent, so we leave NULL to keep the "no override" state
 *     visible (the Contacts-page badge renders for non-English only).
 *
 * Failure mode:
 *   Any DB error is swallowed + logged. Language auto-detect failing
 *   should NEVER break the inbound-message pipeline. Missing a detection
 *   is a minor UX regression; dropping an inbound SMS is a dropped
 *   lead.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyInboundLanguage } from "./detectScript";

export type AutoDetectResult =
  | { kind: "set"; language: "zh" }
  | { kind: "already_set"; existing: string }
  | { kind: "no_change"; detected: "en" }
  | { kind: "error"; error: string };

/**
 * Reads + conditionally updates `contacts.preferred_language`.
 *
 * The Supabase client is passed in (rather than imported module-scoped)
 * because the caller paths already have their own clients (supabaseAdmin
 * vs supabaseServer) and we want this helper to be agnostic.
 */
export async function autoDetectContactLanguage({
  supabase,
  contactId,
  inboundText,
}: {
  supabase: SupabaseClient;
  contactId: string;
  inboundText: string;
}): Promise<AutoDetectResult> {
  try {
    const { data, error } = await supabase
      .from("contacts")
      .select("preferred_language")
      .eq("id", contactId)
      .maybeSingle();

    if (error) return { kind: "error", error: error.message };
    const existing = (data as { preferred_language: string | null } | null)?.preferred_language ?? null;

    if (existing) {
      return { kind: "already_set", existing };
    }

    const detected = classifyInboundLanguage(inboundText);

    if (detected === "en") {
      // Don't write 'en' — keep NULL so the "no explicit preference"
      // state stays visible downstream (see the Contacts-page badge
      // logic which treats 'en' and NULL as the same common case).
      return { kind: "no_change", detected };
    }

    const { error: updateError } = await supabase
      .from("contacts")
      .update({ preferred_language: detected })
      .eq("id", contactId);

    if (updateError) return { kind: "error", error: updateError.message };
    return { kind: "set", language: detected };
  } catch (err) {
    return {
      kind: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
