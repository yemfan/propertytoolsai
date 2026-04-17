import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Probe for the presence of a set of database relations (tables or views) by
 * running a zero-row select against each. If the relation is missing,
 * PostgREST responds with code 42P01 — we translate that into a simple
 * boolean present/missing flag.
 *
 * This is the mechanism behind /api/health/migrations, which surfaces
 * "migrations applied?" state to operators so a dashboard crash like the
 * April 17 Sphere regression can be caught in one curl call instead of
 * getting reported by a user.
 */

export type RelationCheck = {
  name: string;
  kind: "table" | "view";
  /** Human-readable name of the migration that creates this relation. */
  migration?: string;
  present: boolean;
  error: string | null;
};

type RequiredRelation = Pick<RelationCheck, "name" | "kind" | "migration">;

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

function isMissingRelationError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  return e.code === "42P01" || /does not exist|schema cache/i.test(e.message ?? "");
}

async function checkOne(relation: RequiredRelation): Promise<RelationCheck> {
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

export type SchemaHealthReport = {
  ok: boolean;
  checkedAt: string;
  relations: RelationCheck[];
  missing: RelationCheck[];
  /** Migration files that contain at least one missing relation. */
  missingMigrations: string[];
};

export async function checkDashboardSchemaHealth(): Promise<SchemaHealthReport> {
  const relations = await Promise.all(DASHBOARD_REQUIRED_RELATIONS.map(checkOne));
  const missing = relations.filter((r) => !r.present);
  const missingMigrations = Array.from(
    new Set(missing.map((r) => r.migration).filter((m): m is string => !!m)),
  );
  return {
    ok: missing.length === 0,
    checkedAt: new Date().toISOString(),
    relations,
    missing,
    missingMigrations,
  };
}
