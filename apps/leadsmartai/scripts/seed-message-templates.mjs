/**
 * Seed `public.templates` from the handoff JSON.
 * Idempotent: uses upsert keyed on templates.id, so re-running is safe.
 *
 * Usage (from apps/leadsmartai):
 *   node ./scripts/seed-message-templates.mjs
 *   node ./scripts/seed-message-templates.mjs --file "C:/path/to/leadsmart-template-library.json"
 *   TEMPLATES_JSON="C:/path/to/file.json" node ./scripts/seed-message-templates.mjs
 *
 * Env vars required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (server-side keys — do not ship in client)
 *
 * Default source lives in apps/propertytoolsai docs (present in the main checkout,
 * not always in a worktree):
 *   apps/propertytoolsai/docs/proptotypes/leadsmart/leadsmart-handoff/03-template-library/leadsmart-template-library.json
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..", "..");
const DEFAULT_REL = join(
  "apps",
  "propertytoolsai",
  "docs",
  "proptotypes",
  "leadsmart",
  "leadsmart-handoff",
  "03-template-library",
  "leadsmart-template-library.json",
);

function resolveLibraryPath() {
  // 1. --file <path> arg
  const argIdx = process.argv.indexOf("--file");
  if (argIdx > -1 && process.argv[argIdx + 1]) {
    const p = process.argv[argIdx + 1];
    return isAbsolute(p) ? p : resolve(process.cwd(), p);
  }
  // 2. TEMPLATES_JSON env var
  if (process.env.TEMPLATES_JSON) {
    const p = process.env.TEMPLATES_JSON;
    return isAbsolute(p) ? p : resolve(process.cwd(), p);
  }
  // 3. This checkout (works in main; fails in a worktree lacking the file).
  const hereCheckout = join(repoRoot, DEFAULT_REL);
  if (existsSync(hereCheckout)) return hereCheckout;
  // 4. Sibling: climb out of a git worktree into the main checkout.
  //    .claude/worktrees/<name>/apps/leadsmartai/scripts -> ../../../../../../ = main repo root
  const worktreeFallback = join(repoRoot, "..", "..", "..", DEFAULT_REL);
  if (existsSync(worktreeFallback)) return worktreeFallback;
  return hereCheckout; // will fail loudly with a clear path
}

const LIBRARY_PATH = resolveLibraryPath();

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});

/** @param {unknown} body */
function bodyToText(body) {
  if (Array.isArray(body)) return body.join("\n\n");
  if (typeof body === "string") return body;
  return String(body ?? "");
}

/** @param {Record<string, unknown>} trigger */
function extractVariantOf(trigger) {
  if (!trigger || typeof trigger !== "object") return null;
  const paired = trigger.paired_with;
  return typeof paired === "string" ? paired : null;
}

/**
 * Template default status — matches the prototype summary card rules.
 * Sphere + most lifecycle default to review; tour confirmations and ultra-low-risk
 * autosend candidates get 'autosend' out of the box, but only if the agent is
 * past the 30-day gate (enforced in the effective view on the settings side).
 */
function defaultStatusFor(id, category) {
  if (id === "LR-TOUR") return "autosend";
  if (id === "LR-Z01" || id === "LR-Z02" || id === "LR-Z03") return "autosend";
  if (id === "RA-01") return "autosend";
  if (category === "lifecycle") return "autosend"; // from LeadSmart, not from the agent
  return "review";
}

/** @param {unknown} raw */
function toRow(raw) {
  const t = /** @type {Record<string, unknown>} */ (raw);
  const id = String(t.id);
  const category = String(t.category);
  return {
    id,
    category,
    name: String(t.name ?? id),
    channel: String(t.channel ?? "sms"),
    subject: typeof t.subject === "string" ? t.subject : null,
    body: bodyToText(t.body),
    language: "en",
    variant_of: extractVariantOf(/** @type {any} */ (t.trigger) ?? {}),
    placeholders: Array.isArray(t.placeholders) ? t.placeholders : [],
    trigger_config:
      t.trigger && typeof t.trigger === "object" ? /** @type {any} */ (t.trigger) : {},
    notes: typeof t.notes === "string" ? t.notes : null,
    default_status: defaultStatusFor(id, category),
    source:
      t.source === "spec" || t.source === "spec_expanded" || t.source === "invented"
        ? t.source
        : "invented",
    updated_at: new Date().toISOString(),
  };
}

async function main() {
  const json = JSON.parse(readFileSync(LIBRARY_PATH, "utf8"));
  if (!Array.isArray(json.templates)) {
    console.error("Invalid JSON — expected a `templates` array.");
    process.exit(1);
  }
  const rows = json.templates.map(toRow);

  console.log(`Seeding ${rows.length} templates…`);

  // Upsert in two passes so child variant_of rows can reference parents that
  // are inserted in the same run.
  const parents = rows.filter((r) => !r.variant_of);
  const variants = rows.filter((r) => r.variant_of);

  for (const batch of [parents, variants]) {
    if (!batch.length) continue;
    const { error } = await supabase
      .from("templates")
      .upsert(batch, { onConflict: "id" });
    if (error) {
      console.error("Upsert failed:", error);
      process.exit(1);
    }
  }

  console.log(`✓ Seeded ${parents.length} parents + ${variants.length} variants.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
