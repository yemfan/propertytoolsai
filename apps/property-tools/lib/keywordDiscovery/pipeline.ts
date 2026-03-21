import { expandSeedKeywordsWithAi } from "./aiExpansion";
import { assignClusterSlug } from "./clusterAssign";
import { dedupeCandidates } from "./dedupe";
import {
  fetchExistingScoresForNormalized,
  finalizeDiscoveryRun,
  insertDiscoveryRun,
  upsertKeywordCandidates,
} from "./db";
import { expandSeedHeuristically } from "./localExpansion";
import { classifyIntentHeuristic, parseIntent } from "./intent";
import { displayKeyword, normalizeKeywordForDedupe } from "./normalize";
import { scoreKeyword } from "./scoring";
import type { DiscoveryPipelineResult, KeywordCandidate, KeywordIntent } from "./types";

function rowToCandidate(
  phrase: string,
  intent: KeywordIntent,
  sourceSeed: string,
  clusterHint: string | null | undefined
): KeywordCandidate | null {
  const normalized_keyword = normalizeKeywordForDedupe(phrase);
  if (!normalized_keyword) return null;
  const cluster_slug = assignClusterSlug(phrase, clusterHint);
  const score = scoreKeyword({ phrase, sourceSeed, intent });
  return {
    normalized_keyword,
    display_keyword: displayKeyword(phrase),
    intent,
    score,
    cluster_slug,
    source_seed: sourceSeed,
  };
}

export async function runKeywordDiscovery(input: {
  seeds: string[];
  minPerSeed?: number;
  persist?: boolean;
}): Promise<DiscoveryPipelineResult> {
  const seeds = input.seeds.map((s) => String(s).trim()).filter(Boolean);
  const minPerSeed = Math.max(30, Math.min(input.minPerSeed ?? 50, 120));
  const persist = input.persist !== false;

  if (seeds.length === 0) {
    return {
      runId: null,
      seeds: [],
      candidates: [],
      stats: { rawGenerated: 0, afterDedupe: 0, inserted: 0, updated: 0 },
    };
  }

  let runId: string | null = null;
  if (persist) {
    const run = await insertDiscoveryRun({ seeds, minPerSeed });
    if (run.error) {
      return {
        runId: null,
        seeds,
        candidates: [],
        error: run.error,
        stats: { rawGenerated: 0, afterDedupe: 0, inserted: 0, updated: 0 },
      };
    }
    runId = run.id ?? null;
  }

  const raw: KeywordCandidate[] = [];
  let rawGenerated = 0;

  for (const seed of seeds) {
    let expanded = await expandSeedKeywordsWithAi(seed, minPerSeed);
    if (expanded.length < minPerSeed) {
      const heur = expandSeedHeuristically(seed, minPerSeed);
      const seen = new Set(expanded.map((e) => normalizeKeywordForDedupe(e.phrase)));
      for (const h of heur) {
        const k = normalizeKeywordForDedupe(h.phrase);
        if (k && !seen.has(k)) {
          seen.add(k);
          expanded.push(h);
        }
        if (expanded.length >= minPerSeed) break;
      }
    }

    rawGenerated += expanded.length;

    for (const ex of expanded) {
      const intent = parseIntent(ex.intent) ?? classifyIntentHeuristic(ex.phrase);
      const c = rowToCandidate(ex.phrase, intent, seed, ex.cluster_hint);
      if (c) raw.push(c);
    }
  }

  const afterDedupeList = dedupeCandidates(raw);
  afterDedupeList.sort((a, b) => b.score - a.score);

  let inserted = 0;
  let updated = 0;

  if (persist && afterDedupeList.length > 0 && runId) {
    const keys = afterDedupeList.map((c) => c.normalized_keyword);
    const existingScores = await fetchExistingScoresForNormalized(keys);
    const up = await upsertKeywordCandidates(
      afterDedupeList.map((c) => ({ ...c, run_id: runId })),
      { existingScores }
    );
    inserted = up.inserted;
    updated = up.updated;

    await finalizeDiscoveryRun(runId, {
      candidatesTotal: afterDedupeList.length,
      candidatesNew: inserted,
      candidatesUpdated: updated,
    });
  }

  return {
    runId,
    seeds,
    candidates: afterDedupeList,
    stats: {
      rawGenerated,
      afterDedupe: afterDedupeList.length,
      inserted,
      updated,
    },
  };
}
