"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import twilio from "twilio";
import { Resend } from "resend";
import { completeRun, escalateRun } from "@helm/ai-workforce";
import { enforceAutonomy } from "@/lib/workforce-gating";
import { normalizePhoneE164 } from "@/lib/phone";

async function orgScope() {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value;
  if (!orgId) throw new Error("Not authenticated");
  return orgId;
}

/**
 * Ask Sarah to draft and queue a personalized follow-up SMS for a pipeline lead.
 * Because Sarah is act_with_approval, nothing is sent until the owner approves.
 * Returns "queued" on success, "no_sarah" if Emma isn't seeded, "no_phone" if
 * the lead has no number, or "error" for unexpected failures.
 */
export async function letSarahFollowUp(
  clientId: string,
): Promise<{ status: "queued" | "no_sarah" | "no_phone" | "error"; approvalId?: string }> {
  const orgId = await orgScope();
  const supabase = await createClient();
  const serviceDb = await createServiceClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, first_name, last_name, company, phone, pipeline_stage, expected_value, stage_changed_at")
    .eq("id", clientId)
    .eq("organization_id", orgId)
    .single();
  if (!client) throw new Error("Client not found");

  const phoneResult = normalizePhoneE164((client.phone as string | null) ?? "");
  if (!phoneResult.ok) return { status: "no_phone" };

  const { data: org } = await supabase.from("organizations").select("name").eq("id", orgId).single();
  const orgName = (org?.name as string) ?? "us";

  const clientName =
    [(client.first_name as string | null), (client.last_name as string | null)].filter(Boolean).join(" ") ||
    (client.company as string | null) ||
    "there";
  const days = Math.floor((Date.now() - new Date(client.stage_changed_at as string).getTime()) / 86_400_000);
  const stage = (client.pipeline_stage as string) ?? "lead";
  const value = client.expected_value as number | null;

  // Template for the owner to review and approve — no AI generation.
  const draftBody = `Hi ${clientName}! Checking in from ${orgName} — would love to connect and see how we can help. Available for a quick chat this week? — ${orgName}`;

  const result = await enforceAutonomy(serviceDb, orgId, "sarah", {
    runInput: { channel: "sms", subjectType: "contact", subjectId: clientId },
    approvalSubject: { clientName, stage, daysInStage: days, expectedValue: value, phone: phoneResult.value },
    toolKey: "communication.send_sms",
    toolInput: { to: phoneResult.value, body: draftBody, clientId, clientName },
    description: `Sarah wants to text ${clientName} (${stage}, ${days}d): "${draftBody.slice(0, 60)}…"`,
    // Sarah is act_with_approval — this callback is never called.
    execute: async () => ({ value: null }),
  }).catch(() => ({ status: "no_employee" as const }));

  if (result.status === "no_employee") return { status: "no_sarah" };
  if (result.status === "escalated") {
    revalidatePath("/approvals");
    return { status: "queued", approvalId: result.approvalId };
  }
  return { status: "error" };
}

/**
 * Approve a pending action. Executes the queued tool (currently only
 * communication.send_sms), marks the approval approved, and closes the run.
 */
export async function approveApproval(approvalId: string): Promise<{ ok: boolean; error?: string }> {
  const orgId = await orgScope();
  const supabase = await createClient();
  const serviceDb = await createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: approval } = await supabase
    .from("ai_employee_approvals")
    .select("id, run_id, tool_key, tool_input, status, expires_at")
    .eq("id", approvalId)
    .eq("organization_id", orgId)
    .eq("status", "pending")
    .maybeSingle();

  if (!approval) return { ok: false, error: "Approval not found or already decided." };
  if (new Date(approval.expires_at as string) < new Date()) return { ok: false, error: "This approval has expired." };

  const toolInput = (approval.tool_input ?? {}) as { to?: string; body?: string; clientId?: string };

  try {
    if (approval.tool_key === "communication.send_sms") {
      if (!toolInput.to || !toolInput.body) throw new Error("Missing SMS recipient or body.");

      const { data: org } = await serviceDb.from("organizations").select("twilio_number").eq("id", orgId).single();
      if (!org?.twilio_number) throw new Error("No Twilio number configured.");

      const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
      const sms = await twilioClient.messages.create({ from: org.twilio_number as string, to: toolInput.to, body: toolInput.body });

      await serviceDb.from("messages").insert({
        organization_id: orgId,
        client_id: toolInput.clientId ?? null,
        channel: "sms",
        direction: "outbound",
        from_address: org.twilio_number,
        to_address: toolInput.to,
        body: toolInput.body,
        read: true,
        external_id: sms.sid,
        sent_at: new Date().toISOString(),
      });
    } else if (approval.tool_key === "finance.send_invoice_reminder") {
      type InvoiceItem = { id: string; invoiceNumber: string; clientName: string; clientEmail: string; amount: string; dueDate: string };
      const { invoices = [], orgName = "" } = toolInput as { invoices?: InvoiceItem[]; orgName?: string };
      const resend = new Resend(process.env.RESEND_API_KEY ?? "");
      const from = process.env.RESEND_FROM_EMAIL ?? "billing@helmsmart.ai";
      for (const inv of invoices) {
        if (!inv.clientEmail) continue;
        try {
          await resend.emails.send({
            from,
            to: inv.clientEmail,
            subject: `Payment Reminder: Invoice ${inv.invoiceNumber} — ${orgName}`,
            text: `Hi ${inv.clientName},\n\nThis is a friendly reminder that invoice ${inv.invoiceNumber} for ${inv.amount} was due on ${inv.dueDate}.\n\nPlease reach out if you have any questions or would like to arrange payment.\n\nThank you,\n${orgName}`,
          });
        } catch { /* best-effort per invoice */ }
      }
      revalidatePath("/books/invoices");
    }

    await supabase.from("ai_employee_approvals").update({
      status: "approved",
      decided_by: user?.id ?? null,
      decided_at: new Date().toISOString(),
    }).eq("id", approvalId);

    if (approval.run_id) {
      await completeRun(serviceDb, orgId, approval.run_id as string, {
        status: "succeeded",
        outcome: { approved: true, decidedBy: user?.id, tool: approval.tool_key },
      });
    }

    revalidatePath("/approvals");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Execution failed." };
  }
}

/** Reject a pending action: close the run as escalated, no message sent. */
export async function rejectApproval(approvalId: string): Promise<{ ok: boolean }> {
  const orgId = await orgScope();
  const supabase = await createClient();
  const serviceDb = await createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: approval } = await supabase
    .from("ai_employee_approvals")
    .select("id, run_id, status")
    .eq("id", approvalId)
    .eq("organization_id", orgId)
    .eq("status", "pending")
    .maybeSingle();

  if (!approval) return { ok: false };

  await supabase.from("ai_employee_approvals").update({
    status: "rejected",
    decided_by: user?.id ?? null,
    decided_at: new Date().toISOString(),
  }).eq("id", approvalId);

  if (approval.run_id) {
    await escalateRun(serviceDb, orgId, approval.run_id as string, "Rejected by owner");
  }

  revalidatePath("/approvals");
  return { ok: true };
}

// ─── Alex — Finance ────────────────────────────────────────────────────────────

/** Ask Alex to queue payment reminder emails for all overdue invoices. */
export async function letAlexRemind(): Promise<{ status: "queued" | "no_alex" | "no_overdue" | "error" }> {
  const orgId = await orgScope();
  const supabase = await createClient();
  const serviceDb = await createServiceClient();

  const today = new Date().toISOString().slice(0, 10);
  const { data: raw } = await supabase
    .from("invoices")
    .select("id, invoice_number, total, due_date, clients(first_name, last_name, company, email)")
    .eq("organization_id", orgId)
    .eq("status", "sent")
    .lt("due_date", today)
    .limit(20);

  type InvClient = { first_name?: string | null; last_name?: string | null; company?: string | null; email?: string | null } | null;
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const invoices = (raw ?? []).map((inv) => {
    const c = (Array.isArray(inv.clients) ? inv.clients[0] : inv.clients) as InvClient;
    return {
      id: inv.id as string,
      invoiceNumber: inv.invoice_number as string,
      clientName: [c?.first_name, c?.last_name].filter(Boolean).join(" ") || (c?.company ?? "Client"),
      clientEmail: (c?.email as string | null) ?? "",
      amount: fmt(Number(inv.total)),
      dueDate: inv.due_date as string,
    };
  }).filter((i) => i.clientEmail);

  if (!invoices.length) return { status: "no_overdue" };

  const { data: org } = await supabase.from("organizations").select("name").eq("id", orgId).single();
  const orgName = (org?.name as string) ?? "us";

  const result = await enforceAutonomy(serviceDb, orgId, "alex", {
    runInput: { channel: "email", subjectType: "invoice", subjectId: invoices[0].id },
    approvalSubject: { invoiceCount: invoices.length },
    toolKey: "finance.send_invoice_reminder",
    toolInput: { invoices, orgName },
    description: `Alex wants to send payment reminders for ${invoices.length} overdue invoice${invoices.length > 1 ? "s" : ""}`,
    execute: async () => ({ value: null }),
  }).catch(() => ({ status: "no_employee" as const }));

  if (result.status === "no_employee") return { status: "no_alex" };
  if (result.status === "escalated") { revalidatePath("/approvals"); return { status: "queued" }; }
  return { status: "error" };
}

// ─── Emily — Marketing ─────────────────────────────────────────────────────────

/**
 * Ask Emily to create a draft social post directly — no approval needed.
 * A draft is internal and reversible; the owner edits and publishes it manually
 * from the Social page. Only publishing (external) would warrant approval.
 */
export async function letEmilyDraftPost(): Promise<{ status: "created" | "error" }> {
  const orgId = await orgScope();
  const supabase = await createClient();

  const { data: org } = await supabase.from("organizations").select("name").eq("id", orgId).single();
  const orgName = (org?.name as string) ?? "us";

  const { error } = await supabase.from("social_posts").insert({
    organization_id: orgId,
    platform: "general",
    content: `We'd love to share something with our community at ${orgName}! ✏️ Edit this post before publishing.`,
    status: "draft",
    generated_by_ai: false,
    created_at: new Date().toISOString(),
  });

  if (error) return { status: "error" };
  revalidatePath("/social");
  return { status: "created" };
}

// ─── Mark — Operations ─────────────────────────────────────────────────────────

/**
 * Ask Mark to create a follow-up task directly — no approval needed. Task
 * creation is internal and reversible; gating it behind an approval would be
 * friction for zero benefit. Mark is autonomous for internal ops.
 */
export async function letMarkCreateTask(): Promise<{ status: "created" | "error" }> {
  const orgId = await orgScope();
  const supabase = await createClient();

  const dueDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  const { error } = await supabase.from("tasks").insert({
    organization_id: orgId,
    title: "Review and prioritise open items — update this title",
    notes: "Mark created this task. Edit the title, assign it, and set a due date.",
    priority: "high",
    status: "open",
    due_date: dueDate,
  });

  if (error) return { status: "error" };
  revalidatePath("/tasks");
  return { status: "created" };
}
