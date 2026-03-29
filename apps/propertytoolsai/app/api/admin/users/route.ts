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

export async function GET(req: Request) {
  await requireRole(["admin"]);

  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const role = searchParams.get("role")?.trim();

    let query = supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, role, is_active, created_at")
      .order("created_at", { ascending: false });

    if (q) {
      const pattern = `%${escapeIlikePattern(q)}%`;
      query = query.or(`email.ilike.${pattern},full_name.ilike.${pattern}`);
    }

    if (role && role !== "all") {
      query = query.eq("role", role);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      users: data ?? [],
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

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (role !== undefined) updatePayload.role = role;
    if (isActive !== undefined) updatePayload.is_active = isActive;
    if (fullName !== undefined) updatePayload.full_name = fullName;

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update(updatePayload)
      .eq("id", userId)
      .select("id");

    if (error) throw error;
    if (!data?.length) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "Failed to update user" }, { status: 500 });
  }
}
