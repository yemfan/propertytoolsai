import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { supabaseServer } from "@/lib/supabaseServer";
import type { ComparisonReportResult } from "@/lib/comparisonReportTypes";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      email?: string;
      message?: string;
    };

    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const message = String(body.message ?? "").trim();

    if (!name || !email) {
      return NextResponse.json({ ok: false, error: "Name and email are required." }, { status: 400 });
    }

    const { data: row, error } = await supabaseServer
      .from("comparison_reports")
      .select("id, client_name, result")
      .eq("id", id)
      .maybeSingle();

    if (error || !row) {
      return NextResponse.json({ ok: false, error: "Report not found." }, { status: 404 });
    }

    const result = row.result as unknown as ComparisonReportResult;
    const agentEmail = result?.agent_snapshot?.email?.trim();
    const agentName = result?.agent_snapshot?.display_name ?? "Agent";

    if (!agentEmail) {
      return NextResponse.json(
        { ok: false, error: "Agent contact email is not available for this report." },
        { status: 400 }
      );
    }

    const host = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!host || !smtpUser || !smtpPass) {
      return NextResponse.json(
        { ok: false, error: "Email delivery is not configured on this server." },
        { status: 503 }
      );
    }

    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const subject = `New inquiry from ${name} (comparison report)`;
    const text = `You received a new inquiry from your AI Property Comparison Report.

Report ID: ${id}
Prepared for: ${String((row as any).client_name ?? "")}

From: ${name}
Email: ${email}

Message:
${message || "(no message)"}

---
Sent via LeadSmart AI
`;

    await transporter.sendMail({
      from: `"LeadSmart AI" <${smtpUser}>`,
      to: agentEmail,
      replyTo: email,
      subject,
      text,
    });

    return NextResponse.json({ ok: true, message: `Your message was sent to ${agentName}.` });
  } catch (e: any) {
    console.error("POST inquiry", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Failed to send" }, { status: 500 });
  }
}
