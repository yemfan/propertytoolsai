import { NextResponse } from "next/server";
import { getCurrentUserWithProfile } from "@/lib/auth/getCurrentUser";

export const dynamic = "force-dynamic";

/**
 * Current session + merged profile (user_profiles + leadsmart_users) for client nav / role UI.
 */
export async function GET() {
  const ctx = await getCurrentUserWithProfile();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    id: ctx.profile.id,
    email: ctx.profile.email,
    full_name: ctx.profile.full_name,
    role: ctx.profile.role,
  });
}
