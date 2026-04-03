import { createHash } from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/authFromRequest";

type UsageRole = "anonymous" | "user" | "agent";

export type CmaUsageResult = {
  role: UsageRole;
  used: number;
  limit: number;
  remaining: number;
  reached: boolean;
  warning: boolean;
  reset_date: string;
  subject_key: string;
};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getDailyLimit(role: UsageRole) {
  if (role === "agent") return 10;
  if (role === "user") return 5;
  return 2;
}

function anonSubjectKey(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  const ua = req.headers.get("user-agent") || "unknown";
  const raw = `${ip}|${ua}`;
  return `anon:${createHash("sha256").update(raw).digest("hex").slice(0, 24)}`;
}

async function resolveIdentity(req: Request): Promise<{
  userId: string | null;
  role: UsageRole;
  subjectKey: string;
}> {
  const user = await getUserFromRequest(req);
  if (!user) {
    return {
      userId: null,
      role: "anonymous",
      subjectKey: anonSubjectKey(req),
    };
  }

  let role: UsageRole = "user";
  try {
    const { data: row } = await supabaseServer
      .from("user_profiles")
      .select("leadsmart_users(role)")
      .eq("user_id", user.id)
      .maybeSingle();
    const lsRaw = (row as { leadsmart_users?: { role?: string } | { role?: string }[] } | null)
      ?.leadsmart_users;
    const ls = lsRaw == null ? null : Array.isArray(lsRaw) ? lsRaw[0] : lsRaw;
    const r = String(ls?.role ?? "user").toLowerCase();
    if (r === "agent") role = "agent";
  } catch {
    role = "user";
  }

  return {
    userId: user.id,
    role,
    subjectKey: `user:${user.id}`,
  };
}

export async function getCmaUsage(req: Request): Promise<CmaUsageResult> {
  const identity = await resolveIdentity(req);
  const limit = getDailyLimit(identity.role);
  const today = todayDate();

  let used = 0;

  const { data } = await supabaseServer
    .from("cma_daily_usage")
    .select("cma_usage_count,last_reset_date")
    .eq("subject_key", identity.subjectKey)
    .maybeSingle();

  if (data) {
    const resetDate = String((data as any).last_reset_date ?? "");
    used = resetDate === today ? Number((data as any).cma_usage_count ?? 0) : 0;
  }

  const remaining = Math.max(0, limit - used);
  return {
    role: identity.role,
    used,
    limit,
    remaining,
    reached: used >= limit,
    warning: remaining <= 1,
    reset_date: today,
    subject_key: identity.subjectKey,
  };
}

export async function incrementCmaUsage(req: Request): Promise<CmaUsageResult> {
  const identity = await resolveIdentity(req);
  const limit = getDailyLimit(identity.role);
  const today = todayDate();

  const { data: existing } = await supabaseServer
    .from("cma_daily_usage")
    .select("subject_key,cma_usage_count,last_reset_date")
    .eq("subject_key", identity.subjectKey)
    .maybeSingle();

  let used = 0;
  if (!existing) {
    const { data: inserted, error } = await supabaseServer
      .from("cma_daily_usage")
      .insert({
        subject_key: identity.subjectKey,
        user_id: identity.userId,
        role: identity.role,
        cma_usage_count: 1,
        last_reset_date: today,
      } as any)
      .select("cma_usage_count")
      .single();
    if (error) throw error;
    used = Number((inserted as any)?.cma_usage_count ?? 1);
  } else {
    const resetDate = String((existing as any).last_reset_date ?? "");
    const current = Number((existing as any).cma_usage_count ?? 0);
    if (resetDate !== today) {
      const { data: updated, error } = await supabaseServer
        .from("cma_daily_usage")
        .update({
          cma_usage_count: 1,
          last_reset_date: today,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("subject_key", identity.subjectKey)
        .select("cma_usage_count")
        .single();
      if (error) throw error;
      used = Number((updated as any)?.cma_usage_count ?? 1);
    } else {
      if (current >= limit) {
        used = current;
      } else {
        const { data: updated, error } = await supabaseServer
          .from("cma_daily_usage")
          .update({
            cma_usage_count: current + 1,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("subject_key", identity.subjectKey)
          .select("cma_usage_count")
          .single();
        if (error) throw error;
        used = Number((updated as any)?.cma_usage_count ?? current + 1);
      }
    }
  }

  // Sync to leadsmart_users for logged-in users (legacy CMA daily table + CRM counters).
  if (identity.userId) {
    await supabaseServer
      .from("leadsmart_users")
      .update({
        cma_usage_count: used,
        last_reset_date: today,
      })
      .eq("user_id", identity.userId);
  }

  const remaining = Math.max(0, limit - used);
  return {
    role: identity.role,
    used,
    limit,
    remaining,
    reached: used >= limit,
    warning: remaining <= 1,
    reset_date: today,
    subject_key: identity.subjectKey,
  };
}

