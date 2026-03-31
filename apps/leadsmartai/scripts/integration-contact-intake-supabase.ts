/**
 * Full integration test: contact import pipeline against live Supabase (service role).
 * Exercises createImportJobFromCsv → previewImportJob → finalizeImportJob, then cleans up.
 *
 * Prereq: apps/leadsmartai/.env.local — NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional env:
 *   INTEGRATION_TEST_AGENT_ID — `agents.id` (numeric or uuid), or an Auth user uuid (resolved via `agents.auth_user_id`).
 *   INTEGRATION_TEST_AUTH_USER_ID — auth.users UUID; if no agent row yet, inserts `{ auth_user_id, plan_type: 'free' }`
 *     (no Auth Admin API — works even when listUsers rejects the key).
 * If `agents` is empty and service role JWT is valid, tries auth.admin.listUsers + insert for first user.
 *
 *   pnpm --filter leadsmartai run test:integration:supabase
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** App-local first; then mobile app env (often has the real service_role JWT while leadsmartai still has a placeholder). */
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../../leadsmart-mobile/.env.local"), override: true });

/**
 * Legacy `public.agents.user_id` is often BIGINT NOT NULL, referencing `public.users(id)`.
 * Newer data links Auth via `public.users.user_id` (uuid) = auth user id.
 */
async function insertAgentRow(supabase: SupabaseClient, uid: string): Promise<boolean> {
  const { data: legacyUser, error: luErr } = await supabase
    .from("users")
    .select("id")
    .eq("user_id", uid)
    .maybeSingle();

  if (luErr && !/relation|does not exist|schema cache/i.test(String(luErr.message ?? ""))) {
    console.warn(`[agents.insert] public.users lookup: ${luErr.message}`);
  }

  const legacyId = (legacyUser as { id?: unknown } | null)?.id;
  const numericUserId =
    typeof legacyId === "number"
      ? legacyId
      : typeof legacyId === "string" && /^\d+$/.test(legacyId)
        ? Number(legacyId)
        : null;

  if (numericUserId == null) {
    console.warn(
      "[agents.insert] No `public.users` row with user_id = auth uid (legacy signup). Use the app’s agent onboarding, SQL, or set INTEGRATION_TEST_AGENT_ID."
    );
    return false;
  }

  const payload = {
    user_id: numericUserId,
    auth_user_id: uid,
    plan_type: "free",
  } as Record<string, unknown>;

  const { error } = await supabase.from("agents").insert(payload);
  if (!error) return true;

  const msg = String(error.message ?? "");
  if (/duplicate key|unique constraint/i.test(msg)) {
    return true;
  }

  console.warn(`[agents.insert] ${msg}`);
  return false;
}

/** Match `upgrade-to-agent`: minimal row so CRM + imports can resolve agent context. */
async function tryCreateAgentForFirstAuthUser(supabase: SupabaseClient): Promise<string | null> {
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 5 });
  if (listErr) {
    console.warn(`[auto-agent] auth.admin.listUsers: ${listErr.message}`);
    return null;
  }
  const users = list?.users ?? [];
  if (users.length === 0) {
    console.warn("[auto-agent] No users in auth.users — create a user in Supabase Auth first.");
    return null;
  }

  const uid = users[0].id;
  const ok = await insertAgentRow(supabase, uid);
  if (!ok) return null;

  const { data: row } = await supabase.from("agents").select("id").eq("auth_user_id", uid).maybeSingle();
  if (!row?.id) return null;
  console.log(`  (auto-created agents row for auth user ${uid})`);
  return String((row as { id: unknown }).id);
}

async function tryCreateAgentForEnvUserId(supabase: SupabaseClient): Promise<string | null> {
  const uid = process.env.INTEGRATION_TEST_AUTH_USER_ID?.trim();
  if (!uid) return null;

  const { data: existing } = await supabase.from("agents").select("id").eq("auth_user_id", uid).maybeSingle();
  if (existing?.id) {
    console.log(`  (using existing agents row for INTEGRATION_TEST_AUTH_USER_ID)`);
    return String((existing as { id: unknown }).id);
  }

  const ok = await insertAgentRow(supabase, uid);
  if (!ok) return null;

  const { data: row } = await supabase.from("agents").select("id").eq("auth_user_id", uid).maybeSingle();
  if (!row?.id) return null;
  console.log(`  (created agents row for INTEGRATION_TEST_AUTH_USER_ID)`);
  return String((row as { id: unknown }).id);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `contact_import_jobs.agent_id` follows `agents.id` (often BIGINT). If you paste an Auth user uuid,
 * resolve the real `agents.id` row.
 */
async function resolveIntegrationAgentId(
  supabase: SupabaseClient,
  raw: string
): Promise<string | null> {
  if (!raw) return null;

  if (UUID_RE.test(raw)) {
    const { data: byAuth, error: e1 } = await supabase
      .from("agents")
      .select("id")
      .eq("auth_user_id", raw)
      .maybeSingle();
    if (!e1 && byAuth != null && (byAuth as { id?: unknown }).id != null) {
      const id = String((byAuth as { id: unknown }).id);
      console.log(`  (INTEGRATION_TEST_AGENT_ID matched agents.auth_user_id → agents.id ${id})`);
      return id;
    }

    const { data: byPk, error: e2 } = await supabase.from("agents").select("id").eq("id", raw).maybeSingle();
    if (!e2 && byPk != null && (byPk as { id?: unknown }).id != null) {
      return String((byPk as { id: unknown }).id);
    }

    console.error(
      `✗ INTEGRATION_TEST_AGENT_ID is a uuid but no row in public.agents has auth_user_id or id = ${raw}. ` +
        `Open Supabase → Table Editor → agents and set this variable to the numeric id column (bigint), e.g. INTEGRATION_TEST_AGENT_ID=42`
    );
    return null;
  }

  const { data: exists, error: exErr } = await supabase.from("agents").select("id").eq("id", raw).maybeSingle();
  if (exErr) {
    console.error(`✗ agents: ${exErr.message}`);
    return null;
  }
  if (!exists) {
    const { data: sample } = await supabase.from("agents").select("id").limit(8);
    const ids = (sample ?? [])
      .map((r) => String((r as { id: unknown }).id))
      .filter(Boolean)
      .join(", ");
    console.error(
      `✗ INTEGRATION_TEST_AGENT_ID=${raw} — no row in public.agents with that id. ` +
        (ids ? `Sample ids in DB: ${ids}` : "Table appears empty — create an agent row first.")
    );
    return null;
  }
  return String((exists as { id: unknown }).id);
}

async function resolveAgentId(supabase: SupabaseClient): Promise<string | null> {
  const envRaw = process.env.INTEGRATION_TEST_AGENT_ID?.trim();
  if (envRaw) {
    return resolveIntegrationAgentId(supabase, envRaw);
  }

  const { data: agentRow, error: agentErr } = await supabase.from("agents").select("id").limit(1).maybeSingle();
  if (agentErr) {
    console.error(`✗ agents lookup: ${agentErr.message}`);
    return null;
  }
  if (agentRow) {
    return String((agentRow as { id: unknown }).id);
  }

  const fromEnvUser = await tryCreateAgentForEnvUserId(supabase);
  if (fromEnvUser) return fromEnvUser;

  return tryCreateAgentForFirstAuthUser(supabase);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (apps/leadsmartai/.env.local)"
    );
    process.exitCode = 1;
    return;
  }

  if (!key.startsWith("eyJ")) {
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY should be the JWT from Supabase → Project Settings → API → service_role (starts with eyJ). Otherwise auth.admin.* and DB may behave inconsistently.\n"
    );
  }

  const supabase = createClient(url, key);

  const { createImportJobFromCsv, previewImportJob, finalizeImportJob } = await import(
    "../lib/contact-intake/importJobService"
  );

  console.log("— Schema: contact import + leads intake columns\n");

  const { error: jobsErr } = await supabase.from("contact_import_jobs").select("id,agent_id,status").limit(1);
  if (jobsErr) {
    console.error(`✗ contact_import_jobs: ${jobsErr.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ contact_import_jobs");

  const { error: rowsErr } = await supabase.from("contact_import_rows").select("id,job_id,resolution").limit(1);
  if (rowsErr) {
    console.error(`✗ contact_import_rows: ${rowsErr.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ contact_import_rows");

  const { error: leadsErr } = await supabase
    .from("leads")
    .select("id,intake_channel,import_job_id")
    .limit(1);
  if (leadsErr) {
    console.error(`✗ leads intake columns: ${leadsErr.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ leads.intake_channel / import_job_id");

  const integrationAgentEnv = process.env.INTEGRATION_TEST_AGENT_ID?.trim();
  const agentId = await resolveAgentId(supabase);

  if (!agentId) {
    if (!integrationAgentEnv) {
      console.error(
        "✗ No agent id: ensure `public.agents` has a row (app onboarding or SQL), or set INTEGRATION_TEST_AGENT_ID. Auto-create needs a legacy `public.users` row linked by user_id = auth uid."
      );
    }
    process.exitCode = 1;
    return;
  }
  console.log(`✓ using agent id ${agentId}\n`);

  const tag = `${Date.now()}`;
  const testEmail = `integration-${tag}@leadsmart.test`;
  const csvRows = [
    {
      Name: "Integration Test User",
      Email: testEmail,
      Phone: "5551234567",
    },
  ];

  let jobId: string | null = null;

  const cleanup = async () => {
    await supabase.from("leads").delete().eq("email", testEmail);
    if (jobId) {
      const { error } = await supabase.from("contact_import_jobs").delete().eq("id", jobId);
      if (error) console.warn(`[cleanup] contact_import_jobs delete:`, error.message);
    }
  };

  try {
    console.log("— Pipeline: CSV job → preview → finalize\n");

    const { jobId: jid } = await createImportJobFromCsv({
      agentId,
      userId: null,
      fileName: "integration.csv",
      rows: csvRows,
    });
    jobId = jid;
    console.log(`  created job ${jobId}`);

    const preview = await previewImportJob({
      agentId,
      jobId,
      mapping: { name: "Name", email: "Email", phone: "Phone" },
      duplicateStrategy: "create_anyway",
    });
    if (preview.stats.total < 1) {
      throw new Error("preview expected at least one row");
    }
    console.log(`  preview: ${preview.stats.total} row(s), likelyDuplicates=${preview.stats.likelyDuplicates}`);

    const result = await finalizeImportJob({
      agentId,
      planType: "premium",
      jobId,
      duplicateStrategy: "create_anyway",
      enrichRows: false,
    });
    console.log(`  finalize: inserted=${result.inserted} merged=${result.merged} skipped=${result.skipped} errors=${result.errors}`);

    if (result.inserted < 1 && result.merged < 1) {
      throw new Error("expected at least one inserted or merged lead from integration CSV row");
    }

    const { data: leadCheck, error: lcErr } = await supabase
      .from("leads")
      .select("id,email,import_job_id")
      .eq("email", testEmail)
      .maybeSingle();
    if (lcErr) throw lcErr;
    if (!leadCheck) {
      throw new Error("lead row not found for integration test email");
    }
    console.log(`  lead ${(leadCheck as { id: unknown }).id} email=${testEmail} import_job_id ok\n`);

    console.log("✓ Contact intake integration passed.");
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await cleanup();
    console.log("(cleanup: removed test job and lead row(s))");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
