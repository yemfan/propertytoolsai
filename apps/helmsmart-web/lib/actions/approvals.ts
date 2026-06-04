"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import twilio from "twilio";
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
