/**
 * Verify the App Store Review demo account can actually sign in.
 *
 * Uses the anon key (the same one the mobile app ships with) so this mirrors
 * what an iPad reviewer will experience — admin paths are bypassed.
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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in env.");
  process.exit(1);
}

const supabase = createClient(url, anonKey, { auth: { persistSession: false } });

async function main() {
  console.log(`Supabase URL: ${url}`);
  const email = "demo@leadsmart.ai";
  const password = "Demo123!";
  console.log(`Trying sign-in: ${email} / ${password}\n`);

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error(`✗ Sign-in FAILED: ${error.message} (status ${error.status})`);
    process.exit(1);
  }
  console.log(`✓ Sign-in OK`);
  console.log(`  access_token expires_in: ${data.session?.expires_in}s`);
  console.log(`  user.id:                 ${data.user?.id}`);
  console.log(`  user.email:              ${data.user?.email}`);
  console.log(`  user.email_confirmed_at: ${data.user?.email_confirmed_at}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
