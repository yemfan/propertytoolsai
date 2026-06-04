import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { defaultAvatarForSeed } from "@helm/ui";
import { getBlueprint } from "@helm/ai-workforce";
import { MessageSquare, CheckCircle2, Clock } from "lucide-react";
import { ApprovalActions } from "./approval-actions";
import { ResponsibleEmployee } from "@/components/responsible-employee";

export const metadata: Metadata = { title: "Approvals" };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function expiresIn(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3600_000);
  if (h < 1) return "< 1h left";
  if (h < 24) return `${h}h left`;
  return `${Math.floor(h / 24)}d left`;
}

export default async function ApprovalsPage() {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value ?? "";
  const supabase = await createClient();

  const { data: approvals } = await supabase
    .from("ai_employee_approvals")
    .select(`
      id, channel, subject, tool_key, tool_input, created_at, expires_at,
      ai_employees!employee_id(id, name, slug, role)
    `)
    .eq("organization_id", orgId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  type ApprovalRow = NonNullable<typeof approvals>[number];

  function approvalHeadline(toolKey: string, subject: Record<string, unknown>): string {
    switch (toolKey) {
      case "communication.send_sms":
        return `text ${(subject.clientName as string) ?? "a lead"}`;
      case "finance.send_invoice_reminder":
        return `send payment reminders to ${subject.invoiceCount ?? "overdue"} invoice${(subject.invoiceCount as number) > 1 ? "s" : ""}`;
      default:
        return "take an action";
    }
  }

  function approvalContent(toolKey: string, toolInput: Record<string, unknown>): string | null {
    switch (toolKey) {
      case "communication.send_sms":
        return (toolInput.body as string) ?? null;
      case "finance.send_invoice_reminder": {
        type Inv = { invoiceNumber: string; clientName: string; amount: string; dueDate: string };
        const invs = (toolInput.invoices as Inv[]) ?? [];
        return invs.slice(0, 3).map((i) => `${i.clientName} — ${i.invoiceNumber} (${i.amount}, due ${i.dueDate})`).join("\n") || null;
      }
      default:
        return null;
    }
  }

  function getEmployee(a: ApprovalRow) {
    // Supabase may return the FK join as an array or single object depending on
    // generated types; normalise to the first element in both cases.
    const raw = a.ai_employees as unknown;
    const e = (Array.isArray(raw) ? raw[0] : raw) as { id: string; name: string; slug: string; role: string } | null;
    return e ?? { id: "", name: "AI Employee", slug: "unknown", role: "" };
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8 flex items-start gap-4">
        <div className="flex-1">
          <ResponsibleEmployee slug="sarah" className="mb-3" />
          <h1 className="text-2xl font-semibold text-slate-900">Pending Approvals</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Actions your AI employees want to take — review and approve or reject each one before it sends
          </p>
        </div>
      </div>

      {!approvals?.length ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">All clear</p>
          <p className="text-xs text-slate-400 mt-1">No pending actions — your AI employees are up to date</p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((a) => {
            const emp = getEmployee(a);
            const subject = (a.subject ?? {}) as Record<string, unknown>;
            const toolInput = (a.tool_input ?? {}) as Record<string, unknown>;
            const toolKey = a.tool_key as string;
            const avatar = getBlueprint(emp.slug)?.avatar ?? defaultAvatarForSeed(emp.slug);
            const content = approvalContent(toolKey, toolInput);

            return (
              <div key={a.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                  <img
                    src={`/avatars/${avatar}.png`}
                    alt={emp.name}
                    className="w-8 h-8 rounded-full object-cover bg-slate-100 flex-shrink-0"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">
                      {emp.name} wants to{" "}
                      <span className="text-indigo-700">{approvalHeadline(toolKey, subject)}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {emp.role}
                      {(subject.stage as string | null) ? ` · ${subject.stage} stage` : ""}
                      {subject.daysInStage != null ? ` · ${subject.daysInStage}d` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 text-xs text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    {expiresIn(a.expires_at as string)}
                  </div>
                </div>

                {/* Content preview — for non-editable tools (invoice list, etc.) */}
                {content && toolKey !== "communication.send_sms" && (
                  <div className="px-5 py-4 border-b border-slate-100">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-indigo-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{content}</p>
                    </div>
                  </div>
                )}
                {/* SMS recipient line — shown above the editable textarea */}
                {toolKey === "communication.send_sms" && (toolInput.to as string | null) && (
                  <div className="px-5 py-2 border-b border-slate-100">
                    <p className="text-xs text-slate-400">To: {toolInput.to as string}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="px-5 py-3 bg-slate-50/60">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">{timeAgo(a.created_at as string)}</span>
                  </div>
                  <ApprovalActions
                    approvalId={a.id as string}
                    editableContent={toolKey === "communication.send_sms" ? (toolInput.body as string | undefined) : undefined}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
