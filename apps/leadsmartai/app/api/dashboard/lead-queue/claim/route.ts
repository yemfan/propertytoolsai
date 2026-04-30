import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST /api/dashboard/lead-queue/claim
 *
 * Body: { leadId: string }
 *
 * First-come-first-served claim. The atomic UPDATE guards on
 * `agent_id IS NULL` so a second agent racing for the same lead
 * gets a 409 "already claimed" response.
 *
 * Auto-merge: the contacts table has UNIQUE(agent_id, email). If the
 * claiming agent already has a contact with the queued lead's email,
 * setting agent_id on the queue row would fire the unique constraint
 * (Postgres 23505). It's the same person — the queue row is just a
 * fresh inbound that happens to match an existing contact — so we
 * merge silently: delete the unclaimed queue row, return the
 * existing contact's id with `merged: true`. The UI treats this as
 * a successful claim and deep-links to the existing contact.
 *
 * The merge intentionally does NOT touch the existing contact's
 * fields (no overwriting their notes, rating, etc.). If the queue
 * row had data the agent wants to keep, that's a follow-up — for
 * now we just dedupe.
 */
export async function POST(req: Request) {
  try {
    const supabase = supabaseServerClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const { data: agent } = await supabase
      .from("agents")
      .select("id")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle();

    if (!agent?.id) {
      return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 403 });
    }

    const agentId = String(agent.id);
    const body = (await req.json().catch(() => ({}))) as { leadId?: string };
    const leadId = String(body.leadId ?? "").trim();

    if (!leadId) {
      return NextResponse.json({ ok: false, error: "leadId is required" }, { status: 400 });
    }

    // Atomic claim: only succeeds if agent_id is still null.
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .update({
        agent_id: agentId,
        claimed_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq("id", leadId)
      .is("agent_id", null)
      .select("id, email")
      .maybeSingle();

    if (error) {
      // Auto-merge path: same agent already has a contact with this
      // email. Delete the unclaimed queue row and return the
      // existing contact's id. The agent never sees an error — they
      // just land on their existing contact for this person.
      if (isDuplicateContactEmailError(error)) {
        const existingId = await findExistingContactIdByEmail(agentId, leadId);
        if (existingId) {
          // Best-effort cleanup: delete only if still unclaimed.
          // Guards against a race where another agent claimed the
          // queue row between our update attempt and this delete.
          await supabaseAdmin
            .from("contacts")
            .delete()
            .eq("id", leadId)
            .is("agent_id", null);
          return NextResponse.json({
            ok: true,
            leadId: existingId,
            merged: true,
          });
        }
        // Couldn't resolve the existing contact — fall back to a
        // structured error rather than silently dropping the lead.
        return NextResponse.json(
          {
            ok: false,
            code: "duplicate_contact_email",
            error: "You already have a contact with this email.",
          },
          { status: 409 },
        );
      }
      throw error;
    }

    if (!data) {
      return NextResponse.json(
        { ok: false, code: "already_claimed", error: "Lead already claimed" },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true, leadId: data.id });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error)?.message ?? "Server error" },
      { status: 500 },
    );
  }
}

type SupabaseError = { code?: string; message?: string; details?: string };

/**
 * The PostgREST/Supabase error envelope for a 23505 (unique_violation)
 * carries the constraint name in `details`. Match on that rather than
 * scraping the human message — Postgres can localize messages.
 */
function isDuplicateContactEmailError(err: unknown): boolean {
  const e = err as SupabaseError;
  if (e?.code !== "23505") return false;
  const text = `${e.details ?? ""} ${e.message ?? ""}`;
  return text.includes("uq_contacts_agent_email");
}

/**
 * Look up the existing contact this agent owns whose email matches
 * the queued row, so the UI can deep-link the user to it ("Open
 * existing contact"). Returns null if the lookup fails — the UI
 * still shows a useful error, just without the deep link.
 */
async function findExistingContactIdByEmail(
  agentId: string,
  queueLeadId: string,
): Promise<string | null> {
  try {
    const { data: queueRow } = await supabaseAdmin
      .from("contacts")
      .select("email")
      .eq("id", queueLeadId)
      .maybeSingle();
    const email = (queueRow as { email?: string | null } | null)?.email;
    if (!email) return null;

    const { data: existing } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("agent_id", agentId)
      .eq("email", email)
      .neq("id", queueLeadId)
      .limit(1)
      .maybeSingle();
    const id = (existing as { id?: string | number } | null)?.id;
    return id != null ? String(id) : null;
  } catch {
    return null;
  }
}
