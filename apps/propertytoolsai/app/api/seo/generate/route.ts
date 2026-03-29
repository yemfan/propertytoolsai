import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { upsertSeoPage } from "@/lib/seo-generator/db";
import { generateBatchSeoPages } from "@/lib/seo-generator/service";
import type { SeoGeneratorInput } from "@/lib/seo-generator/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: profile ? 403 : 401 });
    }

    const body = await req.json();
    const inputs = (body?.inputs || []) as SeoGeneratorInput[];
    const persist = Boolean(body?.persist);

    if (!Array.isArray(inputs) || !inputs.length) {
      return NextResponse.json({ success: false, error: "Missing inputs" }, { status: 400 });
    }

    const pages = await generateBatchSeoPages(inputs);

    if (persist) {
      let persisted = 0;
      let persistError: string | undefined;
      for (let i = 0; i < inputs.length; i++) {
        try {
          await upsertSeoPage(inputs[i], pages[i]);
          persisted++;
        } catch (e) {
          persistError = e instanceof Error ? e.message : "Upsert failed";
        }
      }
      return NextResponse.json({
        success: true,
        pages,
        persisted,
        ...(persistError ? { persistError } : {}),
      });
    }

    return NextResponse.json({ success: true, pages });
  } catch (error) {
    console.error("seo generate error:", error);
    return NextResponse.json({ success: false, error: "Failed to generate SEO pages" }, { status: 500 });
  }
}
