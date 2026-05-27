/**
 * Provision the App Store Review demo account.
 *
 * Apple rejected build 1.0.0 (1) on 2026-04-02 under Guideline 2.1 because the
 * credentials Michael provided in App Store Connect (`demo@leadsmart.ai` /
 * `Demo123!`) didn't correspond to a real user — the account had never been
 * created. This script creates it (idempotently) along with an agents row and
 * a small set of demo leads so the reviewer sees a populated app.
 *
 * Idempotent: every step checks for existing state first. Safe to re-run.
 *
 * Usage:
 *   node ./apps/leadsmartai/scripts/seed-app-review-demo-account.mjs
 *
 * Env: reads .env.local in apps/leadsmartai/ automatically.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}

loadDotEnv(join(__dirname, "..", ".env.local"));

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const DEMO_EMAIL = "demo@leadsmart.ai";
const DEMO_PASSWORD = "Demo123!";

// Tag every seeded lead so a future cleanup can find and remove them.
const DEMO_TAG = "[app-review-demo]";

async function findUserByEmail(email) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users ?? [];
    const hit = users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit;
    if (users.length < 200) return null;
  }
  return null;
}

async function ensureAuthUser() {
  console.log(`[1/3] ensure auth.users for ${DEMO_EMAIL}`);
  const existing = await findUserByEmail(DEMO_EMAIL);
  if (existing) {
    console.log(`      → already exists (id=${existing.id})`);

    // Reset the password to the known value in case it was changed.
    const { error: updErr } = await supabase.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (updErr) {
      console.error(`      ! password reset failed: ${updErr.message}`);
    } else {
      console.log(`      → password reset to "${DEMO_PASSWORD}"`);
    }
    return existing;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "LeadSmart Demo", purpose: "app-store-review" },
  });
  if (error) throw error;
  console.log(`      → created (id=${data.user.id})`);
  return data.user;
}

async function ensureAgent(userId) {
  console.log(`[2/3] ensure agents row for auth_user_id=${userId}`);
  const { data: existing, error } = await supabase
    .from("agents")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (existing) {
    console.log(`      → already exists (agent_id=${existing.id})`);
    return existing.id;
  }

  const { data: inserted, error: insErr } = await supabase
    .from("agents")
    .insert({
      auth_user_id: userId,
      plan_type: "pro",
      brand_name: "LeadSmart Demo",
      brokerage: "LeadSmart AI",
      phone: "+13105551234",
      accepts_new_leads: true,
      ai_assistant_enabled: true,
      ai_assistant_mode: "manual",
      onboarding_completed: true,
      service_areas: ["Los Angeles, CA"],
      service_areas_v2: [{ city: "Los Angeles", state: "CA", county: "Los Angeles", radius_miles: 25 }],
      briefing_morning_time: "07:00",
      briefing_evening_time: "18:00",
      briefing_timezone: "America/Los_Angeles",
    })
    .select("id")
    .single();
  if (insErr) throw insErr;
  console.log(`      → created (agent_id=${inserted.id})`);
  return inserted.id;
}

const DEMO_LEADS = [
  {
    name: "Sarah Chen",
    phone: "+13105550101",
    email: "sarah.chen.demo@example.com",
    notes: `${DEMO_TAG} Saw 2BR condo on Wilshire. Pre-approved, ready in 30 days.`,
    source: "Zillow",
  },
  {
    name: "Marcus Reyes",
    phone: "+13105550102",
    email: "marcus.reyes.demo@example.com",
    notes: `${DEMO_TAG} Selling current home in Pasadena, looking for 4BR in Manhattan Beach.`,
    source: "Open House",
  },
  {
    name: "Priya Iyer",
    phone: "+13105550103",
    email: "priya.iyer.demo@example.com",
    notes: `${DEMO_TAG} Just relocated from SF. Renting now, plans to buy in 6 months.`,
    source: "Referral",
  },
];

async function ensureDemoLeads(agentId) {
  console.log(`[3/3] ensure demo leads for agent_id=${agentId}`);
  const { data: existing, error: selErr } = await supabase
    .from("leads")
    .select("id, name")
    .eq("agent_id", agentId)
    .ilike("notes", `%${DEMO_TAG}%`);
  if (selErr) {
    console.log(`      ! select leads failed (${selErr.message}); skipping seed`);
    return;
  }
  if (existing && existing.length >= DEMO_LEADS.length) {
    console.log(`      → ${existing.length} demo leads already present, skipping`);
    return;
  }

  const have = new Set((existing ?? []).map((l) => l.name));
  const toInsert = DEMO_LEADS.filter((l) => !have.has(l.name)).map((l) => ({
    agent_id: agentId,
    name: l.name,
    phone: l.phone,
    email: l.email,
    notes: l.notes,
    source: l.source,
  }));
  if (!toInsert.length) {
    console.log("      → no leads to insert");
    return;
  }

  const { error: insErr } = await supabase.from("leads").insert(toInsert);
  if (insErr) {
    console.log(`      ! insert leads failed (${insErr.message}); inbox may appear empty`);
    return;
  }
  console.log(`      → inserted ${toInsert.length} demo lead(s)`);
}

async function main() {
  console.log(`Supabase URL: ${url}\n`);
  const user = await ensureAuthUser();
  const agentId = await ensureAgent(user.id);
  await ensureDemoLeads(agentId);

  console.log("\n=== Demo account ready ===");
  console.log(`Email:       ${DEMO_EMAIL}`);
  console.log(`Password:    ${DEMO_PASSWORD}`);
  console.log(`auth.users:  ${user.id}`);
  console.log(`agents.id:   ${agentId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
