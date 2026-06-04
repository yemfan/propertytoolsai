/**
 * Generates the 20 AI-employee persona avatars from DiceBear "Notionists"
 * (CC0 1.0 — public domain, commercial-safe, no attribution required) and
 * saves them as static SVGs under apps/helmsmart-web/public/avatars/.
 *
 * Re-run with: node scripts/gen-avatars.mjs
 * Deterministic: the same seeds always produce the same avatars.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "apps", "helmsmart-web", "public", "avatars");
mkdirSync(OUT, { recursive: true });

// 20 varied seeds -> 20 distinct personas; rotating soft pastel backgrounds.
const SEEDS = [
  "Maya", "Leo", "Aria", "Felix", "Nova", "Kai", "Zara", "Ivan", "Luna", "Omar",
  "Priya", "Theo", "Sage", "Diego", "Nina", "Ravi", "Cleo", "Bram", "Yara", "Hugo",
];
const BGS = ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf", "c8f7dc", "fef3c7"];

// Four personas wear formal attire (collared shirts / a tie) so they read as senior,
// professional roles — these are the slots the Core roster assigns to its execs:
// Tim/CIO (persona-04), Sarah/Sales (persona-05), Alex/Finance (persona-06) and
// Mark/COO (persona-13). Everyone else's clothing stays seed-randomised. Keyed by seed;
// forcing only the `body` keeps each persona's own face, hair and glasses.
const FORMAL_BODY = {
  Felix: "variant19", // collared shirt — keeps the glasses (CIO)
  Nova:  "variant13", // open-collar blazer (Sales)
  Kai:   "variant05", // collared button-up (Finance)
  Sage:  "variant20", // collared shirt + tie (COO)
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0;
for (let i = 0; i < SEEDS.length; i++) {
  const id = String(i + 1).padStart(2, "0");
  const bg = BGS[i % BGS.length];
  const body = FORMAL_BODY[SEEDS[i]] ? `&body=${FORMAL_BODY[SEEDS[i]]}` : "";
  const url = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(
    SEEDS[i]
  )}&radius=50&backgroundType=solid&backgroundColor=${bg}${body}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const svg = await res.text();
    if (!svg.trim().startsWith("<svg")) throw new Error("not svg");
    writeFileSync(join(OUT, `persona-${id}.svg`), svg, "utf8");
    ok++;
    process.stdout.write(`persona-${id} (${SEEDS[i]}, bg #${bg}) ${svg.length}b\n`);
  } catch (e) {
    process.stdout.write(`persona-${id} FAILED: ${e.message}\n`);
  }
  await sleep(150); // be gentle on the API
}
process.stdout.write(`\nDone: ${ok}/${SEEDS.length} avatars -> ${OUT}\n`);
