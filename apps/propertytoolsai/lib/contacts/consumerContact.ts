import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getUserFromRequest } from "@/lib/authFromRequest";

/**
 * Resolve the contact row for the currently logged-in consumer on
 * propertytoolsai. Returns null when:
 *   - no logged-in user (anonymous browser)
 *   - logged in but no contact row yet (consumer hasn't unlocked a
 *     report or submitted a lead-capture form, so the contacts table
 *     has nothing keyed to their user_id)
 *
 * Lookup priority:
 *   1. contacts.user_id === auth user id (strongest link, populated by
 *      the home-value unlock + lead-capture paths after B2 lands)
 *   2. contacts.email === auth email (fallback when user_id wasn't
 *      captured — typical for legacy rows inserted before the column
 *      existed). Lower-cased on both sides to match the dedup index.
 *
 * Intentionally does NOT create a contact row on the fly. Creation
 * happens via the existing flows (home-value unlock, lead capture) so
 * attribution (source, lifecycle_stage, agent_id assignment) stays
 * centralized.
 */

export type ConsumerContext = {
  userId: string;
  email: string | null;
  contactId: string;
};

export async function getCurrentConsumerContact(
  req: Request,
): Promise<ConsumerContext | null> {
  const user = await getUserFromRequest(req);
  if (!user) return null;

  const userId = user.id;
  const email = user.email ?? null;

  // Priority 1: user_id FK
  const { data: byUser } = await supabaseAdmin
    .from("contacts")
    .select("id")
    .eq("user_id", userId as never)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (byUser) {
    return {
      userId,
      email,
      contactId: String((byUser as { id: string }).id),
    };
  }

  // Priority 2: email match (and opportunistically backfill user_id
  // so subsequent requests hit priority 1)
  if (email) {
    const { data: byEmail } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byEmail) {
      const contactId = String((byEmail as { id: string }).id);
      // Backfill: link the user to this contact so future lookups
      // are one query instead of two. Fire-and-forget — if it fails
      // (race, already set to another user, constraint), we still
      // return the match.
      await supabaseAdmin
        .from("contacts")
        .update({ user_id: userId } as never)
        .eq("id", contactId)
        .is("user_id", null);
      return { userId, email, contactId };
    }
  }

  return null;
}
