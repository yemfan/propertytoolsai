import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  DEFAULT_RECEPTIONIST_CONFIG,
  type ReceptionistConfig,
  type ReceptionistConfigRow,
} from "./types";

export { DEFAULT_RECEPTIONIST_CONFIG };
export type { ReceptionistConfig };

function mapRow(row: ReceptionistConfigRow): ReceptionistConfig {
  return {
    enabled: row.enabled ?? true,
    businessName: row.business_name ?? "",
    businessNameZh: row.business_name_zh ?? "",
    agentName: row.agent_name ?? "",
    greeting: row.greeting ?? "",
    timezone: row.timezone || "America/New_York",
    extraNotes: row.extra_notes ?? "",
  };
}

/**
 * Read an agent's receptionist config. Returns defaults for an unknown agent,
 * missing row, or any error (incl. the table not existing yet) — so the
 * receptionist keeps working on defaults before the migration is applied.
 */
export async function getReceptionistConfig(
  agentId: string | null | undefined,
): Promise<ReceptionistConfig> {
  if (!agentId) return { ...DEFAULT_RECEPTIONIST_CONFIG };
  try {
    const { data, error } = await supabaseAdmin
      .from("voice_receptionist_settings")
      .select(
        "agent_id, enabled, business_name, business_name_zh, agent_name, greeting, timezone, extra_notes",
      )
      .eq("agent_id", agentId as never)
      .maybeSingle();
    if (error || !data) return { ...DEFAULT_RECEPTIONIST_CONFIG };
    return mapRow(data as unknown as ReceptionistConfigRow);
  } catch {
    return { ...DEFAULT_RECEPTIONIST_CONFIG };
  }
}

export type UpsertReceptionistConfigInput = Partial<ReceptionistConfig>;

/** Insert/replace an agent's receptionist config (merges onto current values). */
export async function upsertReceptionistConfig(
  agentId: string,
  input: UpsertReceptionistConfigInput,
): Promise<ReceptionistConfig> {
  const current = await getReceptionistConfig(agentId);
  const next: ReceptionistConfig = {
    enabled: input.enabled ?? current.enabled,
    businessName: input.businessName ?? current.businessName,
    businessNameZh: input.businessNameZh ?? current.businessNameZh,
    agentName: input.agentName ?? current.agentName,
    greeting: input.greeting ?? current.greeting,
    timezone: input.timezone || current.timezone,
    extraNotes: input.extraNotes ?? current.extraNotes,
  };

  const { error } = await supabaseAdmin.from("voice_receptionist_settings").upsert(
    {
      agent_id: agentId as never,
      enabled: next.enabled,
      business_name: next.businessName || null,
      business_name_zh: next.businessNameZh || null,
      agent_name: next.agentName || null,
      greeting: next.greeting || null,
      timezone: next.timezone,
      extra_notes: next.extraNotes || null,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "agent_id" },
  );
  if (error) throw error;
  return next;
}
