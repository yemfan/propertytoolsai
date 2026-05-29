"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { BusinessHours } from "@/lib/receptionist";

async function ctx() {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value ?? null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { orgId, supabase, user };
}

// ─── Business hours ─────────────────────────────────────────────────────────────

export async function saveBusinessHours(hours: BusinessHours): Promise<{ error?: string }> {
  const { orgId, supabase, user } = await ctx();
  if (!orgId || !user) return { error: "Unauthorized." };

  const { error } = await supabase
    .from("organizations")
    .update({ business_hours: hours })
    .eq("id", orgId);
  if (error) return { error: "Couldn't save business hours." };

  revalidatePath("/voice");
  return {};
}

// ─── Appointment types ──────────────────────────────────────────────────────────

export async function upsertAppointmentType(input: {
  id?: string;
  name: string;
  durationMinutes: number;
  description?: string | null;
  active?: boolean;
}): Promise<{ error?: string; id?: string }> {
  const { orgId, supabase, user } = await ctx();
  if (!orgId || !user) return { error: "Unauthorized." };

  const name = input.name.trim();
  if (!name) return { error: "Name is required." };

  const row = {
    organization_id: orgId,
    name,
    duration_minutes: Math.min(480, Math.max(5, Math.round(input.durationMinutes || 30))),
    description: input.description?.trim() || null,
    active: input.active ?? true,
  };

  if (input.id) {
    const { error } = await supabase
      .from("appointment_types")
      .update(row)
      .eq("id", input.id)
      .eq("organization_id", orgId);
    if (error) return { error: "Couldn't save appointment type." };
    revalidatePath("/voice");
    return { id: input.id };
  }

  const { data, error } = await supabase
    .from("appointment_types")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) return { error: "Couldn't create appointment type." };
  revalidatePath("/voice");
  return { id: data.id };
}

export async function deleteAppointmentType(id: string): Promise<{ error?: string }> {
  const { orgId, supabase, user } = await ctx();
  if (!orgId || !user) return { error: "Unauthorized." };

  const { error } = await supabase
    .from("appointment_types")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) return { error: "Couldn't delete appointment type." };
  revalidatePath("/voice");
  return {};
}

// ─── Knowledge base ─────────────────────────────────────────────────────────────

export async function upsertKnowledgeEntry(input: {
  id?: string;
  title: string;
  content: string;
  active?: boolean;
}): Promise<{ error?: string; id?: string }> {
  const { orgId, supabase, user } = await ctx();
  if (!orgId || !user) return { error: "Unauthorized." };

  const title = input.title.trim();
  const content = input.content.trim();
  if (!title || !content) return { error: "Title and content are required." };

  const row = { organization_id: orgId, title, content, active: input.active ?? true };

  if (input.id) {
    const { error } = await supabase
      .from("knowledge_base")
      .update(row)
      .eq("id", input.id)
      .eq("organization_id", orgId);
    if (error) return { error: "Couldn't save knowledge entry." };
    revalidatePath("/voice");
    return { id: input.id };
  }

  const { data, error } = await supabase
    .from("knowledge_base")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) return { error: "Couldn't create knowledge entry." };
  revalidatePath("/voice");
  return { id: data.id };
}

export async function deleteKnowledgeEntry(id: string): Promise<{ error?: string }> {
  const { orgId, supabase, user } = await ctx();
  if (!orgId || !user) return { error: "Unauthorized." };

  const { error } = await supabase
    .from("knowledge_base")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) return { error: "Couldn't delete knowledge entry." };
  revalidatePath("/voice");
  return {};
}
