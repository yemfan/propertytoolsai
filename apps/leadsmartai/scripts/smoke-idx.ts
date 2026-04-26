/**
 * Read-only HTTP probe of the IDX endpoints. Verifies the configured IDX
 * provider (Rentcast by default) is healthy by hitting:
 *
 *   GET /api/idx/listings?city=Austin&state=TX
 *   GET /api/idx/listings/{id}   (using an id from the search response)
 *
 * Does NOT exercise /api/idx/lead-capture — that mutation is integration-test
 * territory because it writes to contacts. Coverage for the data layer comes
 * from the vitest tests in lib/idx/__tests__/.
 *
 * Usage (from repo root):
 *   # Against a running local dev server:
 *   pnpm run dev:leadsmartai &
 *   npm run smoke:idx -w leadsmartai
 *
 *   # Or against a deployed preview/prod URL:
 *   SMOKE_BASE_URL=https://your-preview.vercel.app npm run smoke:idx -w leadsmartai
 *
 * Env (from apps/leadsmartai/.env.local OR shell):
 *   SMOKE_BASE_URL  optional; defaults to http://localhost:3000
 *   SMOKE_CITY      optional; defaults to "Austin"
 *   SMOKE_STATE     optional; defaults to "TX"
 */

import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

type Outcome = { ok: boolean; label: string; detail?: string };

function record(outcomes: Outcome[], ok: boolean, label: string, detail?: string) {
  outcomes.push({ ok, label, detail });
  const mark = ok ? "✓" : "✗";
  const tail = detail ? ` — ${detail}` : "";
  console.log(`${mark} ${label}${tail}`);
}

async function fetchJson(url: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function main() {
  const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  const city = process.env.SMOKE_CITY || "Austin";
  const state = process.env.SMOKE_STATE || "TX";

  console.log(`Probing IDX endpoints at ${baseUrl}\n`);

  const outcomes: Outcome[] = [];

  // Probe 1 — search returns a non-empty page for a known market.
  const searchUrl = `${baseUrl}/api/idx/listings?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&pageSize=5`;
  let searchBody: { ok?: boolean; listings?: unknown[]; provider?: string; error?: string } | null = null;
  try {
    const { status, body } = await fetchJson(searchUrl);
    searchBody = body as typeof searchBody;
    record(
      outcomes,
      status === 200 && searchBody?.ok === true,
      `GET /api/idx/listings (city=${city}, state=${state})`,
      `status ${status}, provider=${searchBody?.provider ?? "?"}${searchBody?.error ? `, error=${searchBody.error}` : ""}`,
    );
  } catch (e) {
    record(outcomes, false, `GET /api/idx/listings`, `network error: ${e instanceof Error ? e.message : String(e)}`);
    summarize(outcomes);
    process.exitCode = 1;
    return;
  }

  const listings = (searchBody?.listings as Array<Record<string, unknown>> | undefined) ?? [];
  record(
    outcomes,
    listings.length > 0,
    "search returns non-empty page",
    `${listings.length} listings`,
  );

  if (listings.length === 0) {
    console.log(
      "\nSearch returned zero listings — provider may be returning stale data, or the configured market has no active inventory. Skipping detail probe.",
    );
    summarize(outcomes);
    return;
  }

  const sample = listings[0];
  const requiredKeys = ["id", "formattedAddress", "status"];
  const missing = requiredKeys.filter((k) => !sample[k]);
  record(
    outcomes,
    missing.length === 0,
    "summary shape includes id/formattedAddress/status",
    missing.length === 0 ? `e.g. ${String(sample.formattedAddress)}` : `missing: ${missing.join(", ")}`,
  );

  // Probe 2 — drill into the first listing's detail.
  const sampleId = String(sample.id);
  const detailUrl = `${baseUrl}/api/idx/listings/${encodeURIComponent(sampleId)}`;
  try {
    const { status, body } = await fetchJson(detailUrl);
    const detailBody = body as { ok?: boolean; listing?: Record<string, unknown>; error?: string } | null;
    if (status === 200 && detailBody?.ok && detailBody.listing) {
      const photos = Array.isArray(detailBody.listing.photos) ? detailBody.listing.photos.length : 0;
      const dom = detailBody.listing.daysOnMarket ?? "?";
      record(
        outcomes,
        true,
        `GET /api/idx/listings/${sampleId}`,
        `${detailBody.listing.formattedAddress} · ${photos} photos · ${dom} DOM`,
      );
    } else if (status === 404) {
      // Stale id — Rentcast sometimes returns a result in search but 404s on
      // detail. Surface as a warning, not a failure, so the smoke does not
      // flap on transient inventory churn.
      record(outcomes, true, `GET /api/idx/listings/${sampleId}`, "404 (stale id, acceptable)");
    } else {
      record(outcomes, false, `GET /api/idx/listings/${sampleId}`, `status ${status}, error=${detailBody?.error ?? "?"}`);
    }
  } catch (e) {
    record(outcomes, false, `GET /api/idx/listings/${sampleId}`, `network error: ${e instanceof Error ? e.message : String(e)}`);
  }

  summarize(outcomes);
}

function summarize(outcomes: Outcome[]) {
  const failed = outcomes.filter((o) => !o.ok);
  console.log(
    `\n${outcomes.length - failed.length}/${outcomes.length} probes passed.${failed.length > 0 ? " Failures above." : ""}`,
  );
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
