import { handleHomeValueEstimatePost } from "@/lib/homeValue/postHomeValueEstimate";

export const runtime = "nodejs";

/**
 * POST /api/home-value-estimate — canonical home value estimate API.
 * Same handler as `POST /api/home-value/estimate`.
 *
 * Accepts flat `HomeValueEstimateRequest` or nested `{ address, details?, context? }`.
 */
export async function POST(req: Request) {
  return handleHomeValueEstimatePost(req);
}
