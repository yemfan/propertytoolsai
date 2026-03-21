import { NextResponse } from "next/server";
import { importMlsCsv } from "@/lib/mlsImport";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json(
        { ok: false, error: "CSV file is required (field name: file)." },
        { status: 400 }
      );
    }

    // Next.js provides a Web File instance in route handlers.
    const csvFile = file as unknown as File;
    const csvText = await csvFile.text();

    if (!csvText.trim()) {
      return NextResponse.json(
        { ok: false, error: "CSV file is empty." },
        { status: 400 }
      );
    }

    const result = await importMlsCsv(csvText);

    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    console.error("import-mls-csv error", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

