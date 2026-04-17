/**
 * Seed the Sphere module with 7 demo contacts + a few signals so you can
 * verify the /dashboard/sphere, /dashboard/sphere/[id], and /dashboard/sphere/signals
 * pages end-to-end. Idempotent: deletes any prior demo rows for this agent
 * (tagged via relationship_tag) before re-inserting.
 *
 * Usage (from apps/leadsmartai):
 *   $env:SUPABASE_URL = "https://<ref>.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "<service role key>"
 *   node ./scripts/seed-sphere-demo.mjs --agent-id <uuid-or-bigint>
 *   # or: AGENT_ID=... node ./scripts/seed-sphere-demo.mjs
 *   # or: --agent-email agent@example.com  (looks up agents.auth_user_id -> auth.users.email)
 *
 * Data mirrors the prototype's MOCK_CONTACTS — same 7 names, rough demographics,
 * realistic equity + dormancy + a refi + a job-change signal.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const DEMO_TAG_PREFIX = "[demo]";

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : null;
}

async function resolveAgentId() {
  const explicit = argValue("--agent-id") ?? process.env.AGENT_ID;
  if (explicit) return String(explicit);

  const email = argValue("--agent-email") ?? process.env.AGENT_EMAIL;
  if (email) {
    // Find the auth user, then the agents row linked to them.
    const { data: users } = await supabase.auth.admin.listUsers({ perPage: 200 });
    const user = users?.users?.find(
      (u) => (u.email || "").toLowerCase() === email.toLowerCase(),
    );
    if (!user) {
      console.error(`No auth user found for ${email}.`);
      process.exit(1);
    }
    const { data: agent } = await supabase
      .from("agents")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!agent?.id) {
      console.error(`No agents row for auth_user_id=${user.id}.`);
      process.exit(1);
    }
    return String(agent.id);
  }

  console.error(
    "Pass --agent-id <id> or AGENT_ID=<id> (or --agent-email <email> to look it up).",
  );
  process.exit(1);
}

function iso(d) {
  return new Date(d).toISOString();
}

/** Days ago as an ISO timestamp. */
function daysAgo(n) {
  return iso(Date.now() - n * 24 * 60 * 60 * 1000);
}

/** Build the 7 demo contacts. Anchor "today" to the current runtime. */
function buildContacts(agentId) {
  return [
    {
      first_name: "David",
      last_name: "Chen",
      email: "david.chen@example.com",
      phone: "+12535550147",
      avatar_color: "#8F4A2E",
      address: "2418 Oakhurst Dr, Lakewood WA",
      closing_address: "2418 Oakhurst Dr, Lakewood WA",
      closing_date: "2024-11-14",
      closing_price: 845000,
      avm_current: 912000,
      avm_updated_at: daysAgo(3),
      relationship_type: "past_buyer_client",
      relationship_tag: `${DEMO_TAG_PREFIX} Referred by J. Patel`,
      anniversary_opt_in: true,
      preferred_language: "en",
      last_touch_date: daysAgo(68),
      __signals: [],
    },
    {
      first_name: "Mara",
      last_name: "Tran",
      email: "mara@example.com",
      phone: "+12065550183",
      avatar_color: "#5C4A3E",
      address: "814 Alder St, Seattle WA",
      closing_address: "814 Alder St, Seattle WA",
      closing_date: "2021-03-22",
      closing_price: 620000,
      avm_current: 795000,
      avm_updated_at: daysAgo(3),
      relationship_type: "past_buyer_client",
      relationship_tag: `${DEMO_TAG_PREFIX} Past client · referred 2`,
      anniversary_opt_in: true,
      preferred_language: "en",
      last_touch_date: daysAgo(20),
      __signals: [
        {
          signal_type: "equity_milestone",
          label: "Equity crossed +28%",
          confidence: "high",
          suggested_action: "Send EM-01 equity milestone SMS",
          detected_at: daysAgo(7),
        },
      ],
    },
    {
      first_name: "Jim",
      last_name: "Patel",
      email: "jim.p@example.com",
      phone: "+14255550221",
      avatar_color: "#6B5D4E",
      address: "3102 Cedar Ln, Bellevue WA",
      closing_address: "3102 Cedar Ln, Bellevue WA",
      closing_date: "2019-07-08",
      closing_price: 980000,
      avm_current: 1285000,
      avm_updated_at: daysAgo(4),
      relationship_type: "past_buyer_client",
      relationship_tag: `${DEMO_TAG_PREFIX} Top referrer · 3 deals`,
      anniversary_opt_in: true,
      preferred_language: "en",
      last_touch_date: daysAgo(152),
      __signals: [
        {
          signal_type: "refi_detected",
          label: "Refi detected · Q1 2026",
          confidence: "medium",
          suggested_action: "Call — offer free home-value check",
          detected_at: daysAgo(28),
        },
      ],
    },
    {
      first_name: "Priya",
      last_name: "Ramakrishnan",
      email: "priya.r@example.com",
      phone: "+12535550412",
      avatar_color: "#7A5B42",
      address: "547 Thornton Pl, Tacoma WA",
      closing_address: "547 Thornton Pl, Tacoma WA",
      closing_date: "2023-06-30",
      closing_price: 540000,
      avm_current: 598000,
      avm_updated_at: daysAgo(5),
      relationship_type: "past_buyer_client",
      relationship_tag: `${DEMO_TAG_PREFIX} First-time buyer`,
      anniversary_opt_in: true,
      preferred_language: "en",
      last_touch_date: daysAgo(14),
      __signals: [],
    },
    {
      first_name: "Derek",
      last_name: "Okafor",
      email: "d.okafor@example.com",
      phone: "+14255550778",
      avatar_color: "#4A3E33",
      address: "1890 Pine Ridge Rd, Kirkland WA",
      closing_address: null,
      closing_date: null,
      closing_price: null,
      avm_current: null,
      avm_updated_at: null,
      relationship_type: "sphere_non_client",
      relationship_tag: `${DEMO_TAG_PREFIX} College friend · realtor's husband`,
      anniversary_opt_in: false,
      preferred_language: "en",
      last_touch_date: daysAgo(117),
      __signals: [],
    },
    {
      first_name: "Carlos",
      last_name: "Guerrero",
      email: "carlos.g@example.com",
      phone: "+12535550664",
      avatar_color: "#8F4A2E",
      address: "225 Harbor View Dr, Gig Harbor WA",
      closing_address: "225 Harbor View Dr, Gig Harbor WA",
      closing_date: "2022-09-04",
      closing_price: 725000,
      avm_current: 840000,
      avm_updated_at: daysAgo(3),
      relationship_type: "past_seller_client",
      relationship_tag: `${DEMO_TAG_PREFIX} Past seller · buying next`,
      anniversary_opt_in: true,
      preferred_language: "en",
      last_touch_date: daysAgo(85),
      __signals: [
        {
          signal_type: "job_change",
          label: "Job change detected · Austin TX",
          confidence: "high",
          suggested_action: "Call — likely selling, offer referral to Austin agent",
          detected_at: daysAgo(8),
        },
      ],
    },
    {
      first_name: "Elena",
      last_name: "Kovalenko",
      email: "elena.k@example.com",
      phone: "+12065550915",
      avatar_color: "#6B4A3E",
      address: "4420 Madrona Way, Mercer Island WA",
      closing_address: null,
      closing_date: null,
      closing_price: null,
      avm_current: null,
      avm_updated_at: null,
      relationship_type: "referral_source",
      relationship_tag: `${DEMO_TAG_PREFIX} Sent 4 referrals in 2025`,
      anniversary_opt_in: false,
      preferred_language: "en",
      last_touch_date: daysAgo(44),
      __signals: [],
    },
  ].map((c) => ({ ...c, agent_id: agentId }));
}

async function main() {
  const agentId = await resolveAgentId();
  console.log(`Seeding Sphere demo for agent ${agentId}…`);

  // Clear prior demo rows — identified by the tag prefix. signals cascade.
  const { data: existing } = await supabase
    .from("sphere_contacts")
    .select("id, relationship_tag")
    .eq("agent_id", agentId)
    .like("relationship_tag", `${DEMO_TAG_PREFIX}%`);
  if (existing?.length) {
    const ids = existing.map((r) => r.id);
    const { error: delErr } = await supabase
      .from("sphere_contacts")
      .delete()
      .in("id", ids);
    if (delErr) {
      console.error("Failed to clear prior demo rows:", delErr);
      process.exit(1);
    }
    console.log(`Cleared ${ids.length} prior demo contacts.`);
  }

  const rows = buildContacts(agentId);
  const contactInsert = rows.map(({ __signals: _s, ...rest }) => rest);

  const { data: inserted, error: insErr } = await supabase
    .from("sphere_contacts")
    .insert(contactInsert)
    .select("id, first_name, last_name");
  if (insErr) {
    console.error("Contact insert failed:", insErr);
    process.exit(1);
  }
  console.log(`✓ Inserted ${inserted.length} contacts.`);

  // Map inserted IDs by name to wire up signals.
  const idByName = new Map();
  for (const r of inserted) {
    idByName.set(`${r.first_name} ${r.last_name}`, r.id);
  }

  const signalRows = [];
  for (const c of rows) {
    const contactId = idByName.get(`${c.first_name} ${c.last_name}`);
    if (!contactId) continue;
    for (const s of c.__signals ?? []) {
      signalRows.push({ contact_id: contactId, ...s });
    }
  }

  if (signalRows.length) {
    const { error: sigErr } = await supabase
      .from("sphere_signals")
      .insert(signalRows);
    if (sigErr) {
      console.error("Signal insert failed:", sigErr);
      process.exit(1);
    }
    console.log(`✓ Inserted ${signalRows.length} signals.`);
  }

  console.log("\nDone. Visit /dashboard/sphere to see the ranked list.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
