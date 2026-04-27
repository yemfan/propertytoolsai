import "server-only";

import { topLikelyBuyersForAgent } from "@/lib/buyerPrediction/service";
import { topLikelySellersForAgent } from "@/lib/spherePrediction/service";

import {
  mergeMonetizationRows,
  type BuyerInputRow,
  type MonetizationRow,
  type SellerInputRow,
} from "@/lib/sphereMonetization/mergeRows";

/**
 * Service: run both prediction engines for an agent and join into the
 * combined monetization view. Pulls a wider candidate pool from each side
 * (default 100) so the join surfaces contacts that scored mid-range on
 * one side and high on the other — the agent's biggest leverage points.
 *
 * Both engines run on the same supabase candidate set under the hood, so
 * total query cost is one extra `contacts` + `contact_signals` round-trip
 * vs. fetching either side alone. Worth it for the strategic surface.
 */

const DEFAULT_LIMIT_PER_SIDE = 100;
const HARD_CAP_PER_SIDE = 200;

export async function fetchMonetizationViewForAgent(
  agentId: string,
  opts: { limitPerSide?: number; minScore?: number } = {},
): Promise<MonetizationRow[]> {
  const limit = Math.min(
    Math.max(opts.limitPerSide ?? DEFAULT_LIMIT_PER_SIDE, 1),
    HARD_CAP_PER_SIDE,
  );
  const minScore = Math.max(opts.minScore ?? 0, 0);

  // Run both engines in parallel — independent reads, no shared state.
  const [sellerRows, buyerRows] = await Promise.all([
    topLikelySellersForAgent(agentId, { limit, minScore }),
    topLikelyBuyersForAgent(agentId, { limit, minScore }),
  ]);

  // Project each engine's row shape onto the merger's input shape. The
  // merger is intentionally insulated from each engine's full row type
  // (which includes the heavyweight `factors[]` array) so the combined
  // view stays light over the wire.
  const sellerInputs: SellerInputRow[] = sellerRows.map((r) => ({
    contactId: r.contactId,
    fullName: r.fullName,
    email: r.email,
    phone: r.phone,
    lifecycleStage: r.lifecycleStage,
    closingAddress: r.closingAddress,
    closingDate: r.closingDate,
    score: r.score,
    label: r.label,
    topReason: r.topReason,
  }));

  const buyerInputs: BuyerInputRow[] = buyerRows.map((r) => ({
    contactId: r.contactId,
    fullName: r.fullName,
    email: r.email,
    phone: r.phone,
    lifecycleStage: r.lifecycleStage,
    closingAddress: r.closingAddress,
    closingDate: r.closingDate,
    score: r.score,
    label: r.label,
    topReason: r.topReason,
  }));

  return mergeMonetizationRows(sellerInputs, buyerInputs);
}
