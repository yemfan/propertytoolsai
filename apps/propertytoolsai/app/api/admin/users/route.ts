import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/requireRole";
import { supabaseAdmin } from "@/lib/supabase/admin";

const updateUserSchema = z
  .object({
    userId: z.string().uuid(),
    role: z.enum(["admin", "agent", "loan_broker", "support", "consumer"]).optional(),
    isActive: z.boolean().optional(),
    fullName: z.string().min(1).max(120).optional(),
  })
  .refine(
    (data) =>
      data.role !== undefined ||
      data.isActive !== undefined ||
      data.fullName !== undefined,
    { message: "At least one of role, isActive, or fullName is required" }
  );

/** Escape `%` / `_` / `\` for use inside PostgREST `ilike` patterns. */
function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function normalizeLsRole(db: string | null | undefined): string {
  const r = String(db ?? "user").toLowerCase().trim();
  return r === "user" ? "consumer" : r;
}

export async function GET(req: Request) {
  await requireRole(["admin"]);

  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const roleFilter = searchParams.get("role")?.trim();

    let query = supabaseAdmin
      .from("user_profiles")
      .select(
        "user_id, email, full_name, is_active, created_at, leadsmart_users(role), propertytools_users(tier)"
      )
      .order("created_at", { ascending: false });

    if (q) {
      const pattern = `%${escapeIlikePattern(q)}%`;
      query = query.or(`email.ilike.${pattern},full_name.ilike.${pattern}`);
    }

    const { data, error } = await query;

    if (error) throw error;

    const rows = data ?? [];
    const users = rows
      .map((raw) => {
        const r = raw as {
          user_id: string;
          email: string | null;
          full_name: string | null;
          is_active: boolean | null;
          created_at: string;
          leadsmart_users?: { role?: string } | { role?: string }[] | null;
          propertytools_users?: { tier?: string } | { tier?: string }[] | null;
        };
        const lsRaw = r.leadsmart_users;
        const ls = lsRaw == null ? null : Array.isArray(lsRaw) ? lsRaw[0] : lsRaw;
        const dbRole = ls?.role ?? "user";
        return {
          id: r.user_id,
          email: r.email,
          full_name: r.full_name,
          role: normalizeLsRole(dbRole),
          is_active: r.is_active ?? true,
          created_at: r.created_at,
        };
      })
      .filter((u) => {
        if (!roleFilter || roleFilter === "all") return true;
        return u.role === roleFilter;
      });

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "Failed to load users" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  await requireRole(["admin"]);

  try {
    const body = await req.json();
    const parsed = updateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { userId, role, isActive, fullName } = parsed.data;
    const now = new Date().toISOString();

    if (role !== undefined) {
      const dbRole = role === "consumer" ? "user" : role;
      const { error: lsErr } = await supabaseAdmin
        .from("leadsmart_users")
        .update({ role: dbRole, updated_at: now })
        .eq("user_id", userId);
      if (lsErr) throw lsErr;
    }

    if (isActive !== undefined || fullName !== undefined) {
      const updatePayload: Record<string, unknown> = {
        updated_at: now,
      };
      if (fullName !== undefined) updatePayload.full_name = fullName;
      if (isActive !== undefined) updatePayload.is_active = isActive;

      const { data, error } = await supabaseAdmin
        .from("user_profiles")
        .update(updatePayload)
        .eq("user_id", userId)
        .select("user_id");

      if (error) throw error;
      if (!data?.length) {
        return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
      }
    } else if (role !== undefined) {
      const { data: exists } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (!exists) {
        return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "Failed to update user" }, { status: 500 });
  }
}
