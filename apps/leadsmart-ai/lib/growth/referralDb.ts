import {
  generateReferralCode,
  normalizeReferralCode,
} from "@repo/growth";
import { supabaseServer } from "@/lib/supabaseServer";

export async function createReferralCodeForAgent(params: {
  authUserId: string;
  agentId: string | number;
  label?: string;
}): Promise<{ code: string }> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateReferralCode(8);
    const { error } = await supabaseServer.from("referral_codes").insert({
      code,
      auth_user_id: params.authUserId,
      agent_id: params.agentId as any,
      label: params.label ?? "Agent referral",
    } as any);
    if (!error) return { code };
    if (!String(error.message).includes("duplicate")) throw error;
  }
  throw new Error("Could not allocate referral code");
}

export async function getReferralCodeRow(code: string) {
  const c = normalizeReferralCode(code);
  if (!c) return null;
  const { data } = await supabaseServer.from("referral_codes").select("*").eq("code", c).maybeSingle();
  return data as Record<string, unknown> | null;
}

export async function recordReferralEventSafe(params: {
  code: string;
  eventType: "view" | "click" | "signup" | "conversion" | "share";
  authUserId?: string | null;
  pagePath?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const c = normalizeReferralCode(params.code);
  if (!c) return { ok: false as const, reason: "bad_code" };
  const row = await getReferralCodeRow(c);
  if (!row) return { ok: false as const, reason: "unknown_code" };

  const { error } = await supabaseServer.from("referral_events").insert({
    code: c,
    event_type: params.eventType,
    auth_user_id: params.authUserId ?? null,
    page_path: params.pagePath ?? null,
    metadata: params.metadata ?? {},
  } as any);

  if (error) return { ok: false as const, reason: error.message };

  if (params.eventType === "signup") {
    await supabaseServer
      .from("referral_codes")
      .update({ signups_count: Number(row.signups_count ?? 0) + 1 } as any)
      .eq("code", c);
  } else if (params.eventType === "conversion") {
    await supabaseServer
      .from("referral_codes")
      .update({ conversions_count: Number(row.conversions_count ?? 0) + 1 } as any)
      .eq("code", c);
  } else if (params.eventType === "share") {
    await supabaseServer
      .from("referral_codes")
      .update({ shares_count: Number(row.shares_count ?? 0) + 1 } as any)
      .eq("code", c);
  }

  return { ok: true as const };
}

export async function listReferralCodesForAgent(agentId: string | number) {
  const { data, error } = await supabaseServer
    .from("referral_codes")
    .select("code,label,signups_count,conversions_count,shares_count,created_at")
    .eq("agent_id", agentId as any)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}
