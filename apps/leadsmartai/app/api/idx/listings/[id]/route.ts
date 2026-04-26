import { NextResponse } from "next/server";

import { getIdxAdapter, isIdxFailure } from "@/lib/idx";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
  }

  const adapter = getIdxAdapter();
  const result = await adapter.getListing(id);
  if (isIdxFailure(result)) {
    const status =
      result.error.kind === "not_found"
        ? 404
        : result.error.kind === "unauthorized"
          ? 503
          : result.error.kind === "rate_limited"
            ? 429
            : result.error.kind === "not_configured"
              ? 503
              : 502;
    return NextResponse.json(
      { ok: false, error: result.error.kind, provider: adapter.providerId },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    provider: adapter.providerId,
    listing: result.data,
  });
}
