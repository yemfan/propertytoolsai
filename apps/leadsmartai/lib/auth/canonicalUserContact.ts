import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Contact identity: **Supabase Auth (`auth.users`) is the source of truth.**
 * `public.user_profiles` is kept in sync for RLS joins and legacy reads.
 */
export type CanonicalUserContact = {
  userId: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
};

function identityFromOAuthProvider(meta: Record<string, unknown>): string | null {
  const n = typeof meta.name === "string" ? meta.name.trim() : "";
  if (n) return n;
  const given = typeof meta.given_name === "string" ? meta.given_name.trim() : "";
  const family = typeof meta.family_name === "string" ? meta.family_name.trim() : "";
  const combined = [given, family].filter(Boolean).join(" ").trim();
  if (combined) return combined;
  const nick = typeof meta.nickname === "string" ? meta.nickname.trim() : "";
  if (nick) return nick;
  const pref = typeof meta.preferred_username === "string" ? meta.preferred_username.trim() : "";
  if (pref) return pref;
  return null;
}

export function fullNameFromUserMetadata(meta: Record<string, unknown> | undefined): string | null {
  if (!meta) return null;
  const direct = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  if (direct) return direct;
  return identityFromOAuthProvider(meta);
}

export function oauthBackfillFullName(meta: Record<string, unknown> | undefined): string | null {
  if (!meta) return null;
  const existing = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  if (existing) return null;
  return identityFromOAuthProvider(meta);
}

export function userMetadataWithFullNameOnly(
  meta: Record<string, unknown>,
  fullName: string
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...meta, full_name: fullName };
  delete next.name;
  return next;
}

export function contactFromAuthUser(user: User): CanonicalUserContact {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  return {
    userId: user.id,
    email: user.email ?? null,
    phone: user.phone ?? null,
    fullName: fullNameFromUserMetadata(meta),
  };
}

export async function fetchCanonicalUserContact(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<CanonicalUserContact | null> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data?.user) return null;
  return contactFromAuthUser(data.user);
}

export async function mirrorUserProfileContact(
  supabaseAdmin: SupabaseClient,
  contact: CanonicalUserContact
): Promise<void> {
  const { data: updated, error: upErr } = await supabaseAdmin
    .from("user_profiles")
    .update({
      email: contact.email,
      phone: contact.phone,
      full_name: contact.fullName,
    } as never)
    .eq("user_id", contact.userId)
    .select("user_id");

  if (upErr) throw new Error(upErr.message);

  if (updated?.length) return;

  const { error: insErr } = await supabaseAdmin.from("user_profiles").insert({
    user_id: contact.userId,
    email: contact.email,
    phone: contact.phone,
    full_name: contact.fullName,
  } as never);

  if (insErr) throw new Error(insErr.message);
}

export function toE164Us(digits: string): string | null {
  const d = digits.replace(/\D/g, "");
  if (d.length !== 10) return null;
  return `+1${d}`;
}

export function isValidUsPhone(input: string): boolean {
  return input.replace(/\D/g, "").length === 10;
}
