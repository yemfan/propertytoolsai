"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type NoteKind = "note" | "call" | "meeting" | "email" | "follow_up";

export async function addClientNote(
  clientId: string,
  body: string,
  kind: NoteKind = "note"
) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value ?? "";
  if (!orgId) throw new Error("Not authenticated");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("client_notes").insert({
    organization_id: orgId,
    client_id: clientId,
    author_id: user?.id ?? null,
    body: body.trim(),
    kind,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${clientId}`);
}

export async function deleteClientNote(noteId: string, clientId: string) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value ?? "";
  if (!orgId) throw new Error("Not authenticated");

  const supabase = await createClient();
  const { error } = await supabase
    .from("client_notes")
    .delete()
    .eq("id", noteId)
    .eq("organization_id", orgId);

  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${clientId}`);
}
