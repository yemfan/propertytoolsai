import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Probe for the presence of DB relations (tables/views) and specific columns
 * by running zero-row selects. PostgREST responds with code 42P01 for a
 * missing relation and 42703 for a missing column — we translate those into
 * boolean present/missing flags.
 *
 * Backs /api/health/migrations. Operators can curl that endpoint to see in
 * one shot whether a deploy is ahead of its database.
 */

export type RelationCheck = {
  name: string;
  kind: "table" | "view";
  /** Human-readable name of the migration that creates this relation. */
  migration?: string;
  present: boolean;
  error: string | null;
};

export type ColumnCheck = {
  table: string;
  column: string;
  migration?: string;
  present: boolean;
  error: string | null;
};

type RequiredRelation = Pick<RelationCheck, "name" | "kind" | "migration">;
type RequiredColumn = Pick<ColumnCheck, "table" | "column" | "migration">;

/**
 * Source of truth for "what migrations must be applied for the agent-portal
 * dashboard to fully work." Keep this aligned with the migrations folder —
 * when a new relation becomes load-bearing, add it here so the health check
 * and any future admin UI can report on it.
 */
export const DASHBOARD_REQUIRED_RELATIONS: readonly RequiredRelation[] = [
  // Per-agent AI tone/style — from PR #48 Settings tabbed reorg.
  {
    name: "agent_message_settings",
    kind: "table",
    migration: "20260479000000_agent_message_settings.sql",
  },
  {
    name: "agent_message_settings_effective",
    kind: "view",
    migration: "20260479000000_agent_message_settings.sql",
  },
  // Template library + per-agent overrides.
  { name: "templates", kind: "table", migration: "20260479100000_message_templates.sql" },
  {
    name: "template_overrides",
    kind: "table",
    migration: "20260479100000_message_templates.sql",
  },
  // Sphere module.
  { name: "sphere_contacts", kind: "table", migration: "20260479200000_sphere_module.sql" },
  { name: "sphere_signals", kind: "table", migration: "20260479200000_sphere_module.sql" },
  {
    name: "sphere_contact_triggers",
    kind: "table",
    migration: "20260479200000_sphere_module.sql",
  },
  // Approval queue.
  { name: "message_drafts", kind: "table", migration: "20260479300000_message_drafts.sql" },
  // Scheduler dedup ledger.
  {
    name: "trigger_firings",
    kind: "table",
    migration: "20260479400000_trigger_firings.sql",
  },
];

/**
 * Column-level checks for migrations that add fields to existing tables
 * rather than creating new ones. Each entry probes that specific column
 * exists; missing → migration needs to run.
 */
export const DASHBOARD_REQUIRED_COLUMNS: readonly RequiredColumn[] = [
  // TCPA consent audit trail — from the SMS consent feature.
  {
    table: "user_profiles",
    column: "sms_consent_accepted_at",
    migration: "20260479500000_user_profiles_sms_consent.sql",
  },
  {
    table: "user_profiles",
    column: "sms_consent_ip",
    migration: "20260479500000_user_profiles_sms_consent.sql",
  },
  {
    table: "user_profiles",
    column: "sms_consent_user_agent",
    migration: "20260479500000_user_profiles_sms_consent.sql",
  },
  {
    table: "user_profiles",
    column: "sms_consent_version",
    migration: "20260479500000_user_profiles_sms_consent.sql",
  },
];

function isMissingRelationError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  return e.code === "42P01" || /does not exist|schema cache/i.test(e.message ?? "");
}

function isMissingColumnError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  // 42703: undefined_column. PostgREST also surfaces PGRST204 sometimes.
  return (
    e.code === "42703" ||
    e.code === "PGRST204" ||
    /column .* does not exist|could not find the .* column/i.test(e.message ?? "")
  );
}

async function checkOneRelation(relation: RequiredRelation): Promise<RelationCheck> {
  try {
    const { error } = await supabaseAdmin
      .from(relation.name)
      .select("*", { head: true, count: "exact" })
      .limit(1);
    if (error) {
      if (isMissingRelationError(error)) {
        return { ...relation, present: false, error: error.message };
      }
      return {
        ...relation,
        present: false,
        error: `Unexpected: ${error.message ?? String(error)}`,
      };
    }
    return { ...relation, present: true, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ...relation, present: false, error: msg };
  }
}

async function checkOneColumn(col: RequiredColumn): Promise<ColumnCheck> {
  try {
    const { error } = await supabaseAdmin
      .from(col.table)
      .select(col.column, { head: true })
      .limit(1);
    if (error) {
      if (isMissingColumnError(error)) {
        return { ...col, present: false, error: error.message };
      }
      if (isMissingRelationError(error)) {
        // The whole table is missing — surface that as the column's error
        // too so operators see both gaps at once.
        return { ...col, present: false, error: `Parent table missing: ${error.message}` };
      }
      return {
        ...col,
        present: false,
        error: `Unexpected: ${error.message ?? String(error)}`,
      };
    }
    return { ...col, present: true, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ...col, present: false, error: msg };
  }
}

export type SchemaHealthReport = {
  ok: boolean;
  checkedAt: string;
  relations: RelationCheck[];
  columns: ColumnCheck[];
  missing: Array<RelationCheck | ColumnCheck>;
  /** Migration files that contain at least one missing relation or column. */
  missingMigrations: string[];
};

export async function checkDashboardSchemaHealth(): Promise<SchemaHealthReport> {
  const [relations, columns] = await Promise.all([
    Promise.all(DASHBOARD_REQUIRED_RELATIONS.map(checkOneRelation)),
    Promise.all(DASHBOARD_REQUIRED_COLUMNS.map(checkOneColumn)),
  ]);

  const missingRelations = relations.filter((r) => !r.present);
  const missingColumns = columns.filter((c) => !c.present);
  const missing: Array<RelationCheck | ColumnCheck> = [...missingRelations, ...missingColumns];
  const missingMigrations = Array.from(
    new Set(missing.map((r) => r.migration).filter((m): m is string => !!m)),
  );
  return {
    ok: missing.length === 0,
    checkedAt: new Date().toISOString(),
    relations,
    columns,
    missing,
    missingMigrations,
  };
}
