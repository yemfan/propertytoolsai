import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@helm/data/types";

type Db = SupabaseClient<Database>;

export type NoteKind = "note" | "call" | "meeting" | "email" | "follow_up";

export interface ClientNoteInput {
  clientId: string;
  body: string;
  kind?: NoteKind;
  /** Author user id, if known (nullable for system-generated notes). */
  authorId?: string | null;
}

/** Capture a note against a client. Org-scoped; the caller revalidates. */
export async function insertClientNote(db: Db, orgId: string, input: ClientNoteInput): Promise<void> {
  const { error } = await db.from("client_notes").insert({
    organization_id: orgId,
    client_id: input.clientId,
    author_id: input.authorId ?? null,
    body: input.body.trim(),
    kind: input.kind ?? "note",
  });
  if (error) throw new Error(error.message);
}

/** Delete a note. Org-scoped; the caller revalidates. */
export async function deleteClientNote(db: Db, orgId: string, noteId: string): Promise<void> {
  const { error } = await db
    .from("client_notes")
    .delete()
    .eq("id", noteId)
    .eq("organization_id", orgId);
  if (error) throw new Error(error.message);
}
