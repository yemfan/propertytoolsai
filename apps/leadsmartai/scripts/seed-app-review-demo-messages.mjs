/**
 * Seed realistic SMS conversation threads on the App Store Review demo
 * agent's three demo contacts so the mobile Inbox tab isn't empty when the
 * reviewer signs in.
 *
 * The mobile Inbox endpoint reads from `public.sms_messages` (see
 * apps/leadsmartai/lib/mobile/inbox.ts → fetchSmsForLeads) joined to
 * contacts by `contact_id`. Without these rows the Inbox renders empty and
 * a strict reviewer could flag the app as "incomplete" under Guideline 2.1.
 *
 * Idempotent: per-contact, skips if that contact already has any SMS
 * messages, so re-running this won't duplicate threads. Designed to follow
 * `seed-app-review-demo-account.mjs` (which provisions the contacts).
 *
 * Usage (from repo root):
 *   node ./apps/leadsmartai/scripts/seed-app-review-demo-messages.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
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

const DEMO_AGENT_ID = 31; // matches seed-app-review-demo-account.mjs

/**
 * Hand-crafted realistic threads. Three contacts × 1–3 messages each.
 * Times are spaced so the Inbox sorts Sarah Chen (most-recent) at the top,
 * which is also the lead we're marking "hot" so the Hot Leads filter shows
 * something.
 *
 * Direction values match what the inbox renderer expects: "inbound" puts
 * the bubble on the left (lead → agent); anything else renders as
 * outbound (agent → lead).
 */
const THREADS = [
  {
    contactName: "Sarah Chen",
    markHot: true,
    messages: [
      { offsetMin: -180, direction: "inbound", text: "Hi! Saw the Wilshire condo on Zillow this morning. Is it still available?" },
      { offsetMin: -170, direction: "outbound", text: "Hi Sarah! Yes, still on the market. Want to see it this weekend?" },
      { offsetMin: -45, direction: "inbound", text: "Saturday afternoon works. Around 2pm?" },
    ],
  },
  {
    contactName: "Marcus Reyes",
    markHot: false,
    messages: [
      { offsetMin: -1440, direction: "outbound", text: "Hi Marcus, following up on the Manhattan Beach search. I have three new 4BR listings that match your criteria." },
      { offsetMin: -1380, direction: "inbound", text: "Awesome, send them over!" },
    ],
  },
  {
    contactName: "Priya Iyer",
    markHot: false,
    messages: [
      { offsetMin: -2880, direction: "outbound", text: "Hi Priya, welcome to LA! Whenever you're ready to start looking, I'll have a shortlist tailored to your timeline." },
    ],
  },
];

async function lookupContacts() {
  const { data, error } = await supabase
    .from("contacts")
    .select("id, name")
    .eq("agent_id", DEMO_AGENT_ID);
  if (error) throw error;
  const byName = new Map();
  for (const row of data ?? []) {
    if (row.name) byName.set(row.name, row.id);
  }
  return byName;
}

async function contactHasMessages(contactId) {
  const { count, error } = await supabase
    .from("sms_messages")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", contactId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

async function seedThread(thread, contactId) {
  const has = await contactHasMessages(contactId);
  if (has) {
    console.log(`  → already has SMS messages, skipping`);
    return 0;
  }

  const rows = thread.messages.map((m) => ({
    contact_id: contactId,
    agent_id: DEMO_AGENT_ID,
    direction: m.direction,
    message: m.text,
    twilio_status: m.direction === "outbound" ? "delivered" : "received",
    created_at: new Date(Date.now() + m.offsetMin * 60_000).toISOString(),
  }));

  const { error } = await supabase.from("sms_messages").insert(rows);
  if (error) throw error;
  console.log(`  → inserted ${rows.length} message(s)`);
  return rows.length;
}

async function markHotIfRequested(thread, contactId) {
  if (!thread.markHot) return;
  const { error } = await supabase
    .from("contacts")
    .update({ rating: "hot" })
    .eq("id", contactId);
  if (error) {
    console.log(`  ! could not set rating=hot (${error.message})`);
    return;
  }
  console.log(`  → rating set to "hot"`);
}

async function bumpLastActivity(contactId, latestSentAt) {
  const { error } = await supabase
    .from("contacts")
    .update({
      last_activity_at: latestSentAt,
      last_contacted_at: latestSentAt,
    })
    .eq("id", contactId);
  if (error) {
    console.log(`  ! could not bump last_activity_at (${error.message})`);
  }
}

async function main() {
  console.log(`Supabase URL: ${url}`);
  const contactsByName = await lookupContacts();
  if (!contactsByName.size) {
    console.error(
      "No contacts found for agent_id=" +
        DEMO_AGENT_ID +
        ". Run seed-app-review-demo-account.mjs first."
    );
    process.exit(1);
  }

  let totalInserted = 0;
  for (const thread of THREADS) {
    const contactId = contactsByName.get(thread.contactName);
    if (!contactId) {
      console.log(`[skip] ${thread.contactName} — no matching contact`);
      continue;
    }
    console.log(`\n[seed] ${thread.contactName} (contact_id=${contactId})`);
    const inserted = await seedThread(thread, contactId);
    totalInserted += inserted;
    if (inserted) {
      await markHotIfRequested(thread, contactId);
      // Bump last_activity_at to the latest message's created_at so the
      // Inbox sorts this thread to the top.
      const latestOffset = Math.max(...thread.messages.map((m) => m.offsetMin));
      const latestAt = new Date(Date.now() + latestOffset * 60_000).toISOString();
      await bumpLastActivity(contactId, latestAt);
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`Total messages inserted: ${totalInserted}`);
  console.log(`(re-runs are no-ops; each contact only seeds once)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
