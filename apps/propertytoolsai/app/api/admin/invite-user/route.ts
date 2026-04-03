import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/requireRole";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/siteUrl";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["agent", "loan_broker", "support"]),
  fullName: z.string().min(2).max(120).optional(),
});

export async function POST(req: Request) {
  const admin = await requireRole(["admin"]);

  try {
    const body = await req.json();
    const parsed = inviteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, role, fullName } = parsed.data;

    const siteUrl = getSiteUrl().replace(/\/$/, "");
    const redirectTo = `${siteUrl}/invite/accept`;

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        invited_role: role,
        full_name: fullName ?? null,
      },
    });

    if (error) throw error;

    if (data.user?.id) {
      const uid = data.user.id;
      const now = new Date().toISOString();

      const { error: upErr } = await supabaseAdmin.from("user_profiles").upsert(
        {
          user_id: uid,
          email,
          full_name: fullName ?? null,
          invited_by: admin.id,
          invited_at: now,
        },
        { onConflict: "user_id" }
      );
      if (upErr) throw upErr;

      const { error: lsErr } = await supabaseAdmin.from("leadsmart_users").upsert(
        {
          user_id: uid,
          role,
        },
        { onConflict: "user_id" }
      );
      if (lsErr) throw lsErr;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "Failed to invite user" }, { status: 500 });
  }
}
