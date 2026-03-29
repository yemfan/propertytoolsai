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
      const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
        {
          id: data.user.id,
          email,
          full_name: fullName ?? null,
          role,
          is_active: true,
          invited_by: admin.id,
          invited_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      if (profileError) throw profileError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "Failed to invite user" }, { status: 500 });
  }
}
