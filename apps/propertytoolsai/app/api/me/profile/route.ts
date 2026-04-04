import { NextResponse } from "next/server";
import {
  fullNameFromUserMetadata,
  mirrorUserProfileContact,
  toE164Us,
  isValidUsPhone,
  userMetadataWithFullNameOnly,
} from "@/lib/auth/canonicalUserContact";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseAdmin, isSupabaseServiceConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function isValidProfileEmail(s: string): boolean {
  const t = s.trim();
  return t.length > 3 && t.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

type Body = {
  full_name?: string;
  phone?: string;
  email?: string;
};

/**
 * PATCH /api/me/profile — update profile fields on **Supabase Auth** (`auth.users`), then mirror `user_profiles`.
 * Does not update RBAC `role`; that lives on `leadsmart_users` (admin-assigned).
 */
export async function PATCH(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseServiceConfigured()) {
    return NextResponse.json({ ok: false, error: "Server not configured" }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (
    body.full_name === undefined &&
    body.email === undefined &&
    body.phone === undefined
  ) {
    return NextResponse.json({ ok: false, error: "No valid fields to update" }, { status: 400 });
  }

  const { data: authData, error: authGetErr } = await supabaseAdmin.auth.admin.getUserById(user.id);
  if (authGetErr || !authData?.user) {
    return NextResponse.json({ ok: false, error: "Could not load account." }, { status: 500 });
  }

  const u = authData.user;
  const meta = { ...(u.user_metadata as Record<string, unknown>) };

  let nextFullName =
    typeof body.full_name === "string"
      ? body.full_name.trim()
      : fullNameFromUserMetadata(meta) ?? "";
  let nextEmail = (u.email ?? "").trim();
  let nextPhone: string | null = u.phone ?? null;

  if (typeof body.email === "string") {
    const trimmed = body.email.trim();
    if (!trimmed) {
      return NextResponse.json({ ok: false, error: "Email cannot be empty." }, { status: 400 });
    }
    if (!isValidProfileEmail(trimmed)) {
      return NextResponse.json({ ok: false, error: "Invalid email address." }, { status: 400 });
    }
    nextEmail = trimmed;
  }
  if (typeof body.phone === "string") {
    const t = body.phone.trim();
    if (!t) {
      nextPhone = null;
    } else if (!isValidUsPhone(t)) {
      return NextResponse.json(
        { ok: false, error: "Phone must be a valid US number (10 digits)." },
        { status: 400 }
      );
    } else {
      const e164 = toE164Us(t.replace(/\D/g, ""));
      if (!e164) {
        return NextResponse.json({ ok: false, error: "Invalid phone." }, { status: 400 });
      }
      nextPhone = e164;
    }
  }

  if (!nextEmail) {
    return NextResponse.json({ ok: false, error: "Email is required on your account." }, { status: 400 });
  }

  const nextMeta = userMetadataWithFullNameOnly(meta, nextFullName);

  const { error: authUpErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    email: nextEmail,
    phone: nextPhone ?? undefined,
    user_metadata: nextMeta,
  });

  if (authUpErr) {
    return NextResponse.json(
      { ok: false, error: authUpErr.message || "Could not update profile." },
      { status: 400 }
    );
  }

  try {
    await mirrorUserProfileContact(supabaseAdmin, {
      userId: user.id,
      email: nextEmail,
      phone: nextPhone,
      fullName: nextFullName || null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not sync profile.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
