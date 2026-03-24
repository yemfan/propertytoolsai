import { handleHomeValueEstimatePost } from "@/lib/homeValue/postHomeValueEstimate";

export const runtime = "nodejs";

/**
 * POST /api/home-value/estimate — same pipeline as `/api/home-value-estimate`.
 */
export async function POST(req: Request) {
  return handleHomeValueEstimatePost(req);
}
