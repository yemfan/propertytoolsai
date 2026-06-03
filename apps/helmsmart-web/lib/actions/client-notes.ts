"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  insertClientNote,
  deleteClientNote as deleteClientNoteKnowledge,
  type NoteKind,
} from "@helm/dna-knowledge";

export type { NoteKind };

export async function addClientNote(
  clientId: string,
  body: string,
  kind: NoteKind = "note"
) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value ?? "";
  if (!orgId) throw new Error("Not authenticated");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  await insertClientNote(supabase, orgId, { clientId, body, kind, authorId: user?.id ?? null });
  revalidatePath(`/clients/${clientId}`);
}

export async function deleteClientNote(noteId: string, clientId: string) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value ?? "";
  if (!orgId) throw new Error("Not authenticated");

  const supabase = await createClient();
  await deleteClientNoteKnowledge(supabase, orgId, noteId);
  revalidatePath(`/clients/${clientId}`);
}
