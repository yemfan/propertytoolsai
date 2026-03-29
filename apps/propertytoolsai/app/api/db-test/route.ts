import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  try {
    const { data, error } = await supabaseServer.from("properties").select("id").limit(1);

    if (error) {
      return NextResponse.json(
        { ok: false, message: "Supabase query error", error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Supabase connection succeeded",
      sampleRowCount: data?.length ?? 0,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: "Unexpected error", error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}

