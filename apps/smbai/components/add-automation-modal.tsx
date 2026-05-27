"use client";

import { useState, useTransition } from "react";
import { X, Zap } from "lucide-react";
import {
  createAutomationRule,
  type AutomationTrigger,
  type AutomationAction,
  type AutomationConfig,
  type AutomationRule,
} from "@/lib/actions/automations";

// ─── Option definitions ───────────────────────────────────────────────────────

const TRIGGERS: { value: AutomationTrigger; label: string; hint: string }[] = [
  { value: "invoice_overdue", label: "Invoice becomes overdue", hint: "Fires daily when a sent invoice passes its due date" },
  { value: "invoice_paid",    label: "Invoice is paid",        hint: "Fires when an invoice is marked as paid" },
  { value: "new_lead",        label: "New lead created",       hint: "Fires when a client with status 'lead' is created" },
  { value: "campaign_sent",   label: "Campaign is sent",       hint: "Fires after a marketing campaign is dispatched" },
];

const ACTIONS: { value: AutomationAction; label: string; hint: string }[] = [
  { value: "create_task", label: "Create a task",  hint: "Adds a task to the task list, optionally linked to the client" },
  { value: "send_email",  label: "Send an email",  hint: "Sends a transactional email to the client" },
  { value: "add_note",    label: "Add a note",     hint: "Logs an activity note on the client record" },
];

// Available template variables per trigger
const TRIGGER_VARS: Record<AutomationTrigger, string[]> = {
  invoice_overdue: ["{{client_name}}", "{{invoice_number}}", "{{amount}}"],
  invoice_paid:    ["{{client_name}}", "{{invoice_number}}", "{{amount}}"],
  new_lead:        ["{{client_name}}"],
  campaign_sent:   ["{{campaign_name}}"],
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  onCreated: (rule: AutomationRule) => void;
}

export function AddAutomationModal({ onClose, onCreated }: Props) {
  const [name,    setName]   = useState("");
  const [trigger, setTrigger] = useState<AutomationTrigger>("invoice_overdue");
  const [action,  setAction]  = useState<AutomationAction>("create_task");
  const [config,  setConfig]  = useState<AutomationConfig>({
    title: "Follow up: overdue invoice {{invoice_number}} for {{client_name}}",
    due_offset_days: 1,
  });
  const [error,   setError]   = useState("");
  const [pending, start] = useTransition();

  // Reset config defaults when action changes
  function handleActionChange(next: AutomationAction) {
    setAction(next);
    if (next === "create_task") {
      setConfig({ title: "Follow up with {{client_name}}", due_offset_days: 1 });
    } else if (next === "send_email") {
      setConfig({ email_subject: "An update from us", email_body: "Hi {{client_name}},\n\n" });
    } else {
      setConfig({ note_body: "Automated activity note" });
    }
  }

  function handleTriggerChange(next: AutomationTrigger) {
    setTrigger(next);
    // Keep config but update task title default
    if (action === "create_task") {
      if (next === "invoice_overdue" || next === "invoice_paid") {
        setConfig((c) => ({ ...c, title: `Follow up: ${next === "invoice_overdue" ? "overdue" : "paid"} invoice {{invoice_number}} for {{client_name}}` }));
      } else if (next === "new_lead") {
        setConfig((c) => ({ ...c, title: "Follow up with new lead {{client_name}}" }));
      } else {
        setConfig((c) => ({ ...c, title: "Follow up after campaign {{campaign_name}}" }));
      }
    }
  }

  function handleSubmit() {
    if (!name.trim()) { setError("Name is required"); return; }
    setError("");

    start(async () => {
      try {
        const id = await createAutomationRule({
          name: name.trim(),
          trigger,
          action,
          config,
        });

        onCreated({
          id,
          name: name.trim(),
          enabled: true,
          trigger,
          action,
          config,
          run_count: 0,
          last_run_at: null,
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create automation");
      }
    });
  }

  const vars = TRIGGER_VARS[trigger];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Zap className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-slate-800">New automation</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[calc(100vh-160px)] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Name</label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              placeholder="e.g. Create follow-up task when invoice overdue"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Trigger */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">When this happens…</label>
            <div className="space-y-1.5">
              {TRIGGERS.map((t) => (
                <label
                  key={t.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    trigger === t.value
                      ? "border-indigo-300 bg-indigo-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="trigger"
                    value={t.value}
                    checked={trigger === t.value}
                    onChange={() => handleTriggerChange(t.value)}
                    className="mt-0.5 accent-indigo-600"
                  />
                  <div>
                    <p className={`text-xs font-medium ${trigger === t.value ? "text-indigo-800" : "text-slate-700"}`}>
                      {t.label}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{t.hint}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Action */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Do this…</label>
            <div className="space-y-1.5">
              {ACTIONS.map((a) => (
                <label
                  key={a.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    action === a.value
                      ? "border-indigo-300 bg-indigo-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="action"
                    value={a.value}
                    checked={action === a.value}
                    onChange={() => handleActionChange(a.value)}
                    className="mt-0.5 accent-indigo-600"
                  />
                  <div>
                    <p className={`text-xs font-medium ${action === a.value ? "text-indigo-800" : "text-slate-700"}`}>
                      {a.label}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{a.hint}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Dynamic config fields */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-slate-600">Configure action</p>
              {vars.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {vars.map((v) => (
                    <code key={v} className="text-[10px] bg-slate-100 border border-slate-200 px-1 py-0.5 rounded font-mono text-indigo-600">
                      {v}
                    </code>
                  ))}
                </div>
              )}
            </div>

            {action === "create_task" && (
              <>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Task title</label>
                  <input
                    value={config.title ?? ""}
                    onChange={(e) => setConfig((c) => ({ ...c, title: e.target.value }))}
                    placeholder="Follow up with {{client_name}}"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Due in (days)</label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={config.due_offset_days ?? 1}
                    onChange={(e) => setConfig((c) => ({ ...c, due_offset_days: Number(e.target.value) }))}
                    className="w-24 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </>
            )}

            {action === "send_email" && (
              <>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Email subject</label>
                  <input
                    value={config.email_subject ?? ""}
                    onChange={(e) => setConfig((c) => ({ ...c, email_subject: e.target.value }))}
                    placeholder="Invoice {{invoice_number}} payment reminder"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Email body</label>
                  <textarea
                    rows={5}
                    value={config.email_body ?? ""}
                    onChange={(e) => setConfig((c) => ({ ...c, email_body: e.target.value }))}
                    placeholder="Hi {{client_name}},&#10;&#10;Just a reminder that invoice {{invoice_number}} ({{amount}}) is overdue.&#10;&#10;Please reach out if you have any questions."
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
              </>
            )}

            {action === "add_note" && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Note body</label>
                <textarea
                  rows={3}
                  value={config.note_body ?? ""}
                  onChange={(e) => setConfig((c) => ({ ...c, note_body: e.target.value }))}
                  placeholder="Auto-logged: invoice {{invoice_number}} is overdue"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            disabled={pending}
            className="flex-1 py-2.5 text-sm font-medium border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-60 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={pending || !name.trim()}
            className="flex-1 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {pending ? "Creating…" : "Create automation"}
          </button>
        </div>
      </div>
    </div>
  );
}
