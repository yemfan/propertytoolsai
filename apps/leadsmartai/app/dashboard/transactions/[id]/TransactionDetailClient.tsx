"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DealReviewPanel } from "@/components/dashboard/DealReviewPanel";
import { ListingFeedbackPanel } from "@/components/dashboard/ListingFeedbackPanel";
import { PlaybooksPanel } from "@/components/dashboard/PlaybooksPanel";
import type {
  CounterpartyRole,
  TransactionCounterpartyRow,
  TransactionRow,
  TransactionStage,
  TransactionTaskRow,
} from "@/lib/transactions/types";

type Bundle = {
  transaction: TransactionRow;
  tasks: TransactionTaskRow[];
  counterparties: TransactionCounterpartyRow[];
  contactName: string | null;
};

const STAGE_LABELS: Record<TransactionStage, string> = {
  contract: "Contract",
  inspection: "Inspection",
  appraisal: "Appraisal",
  loan: "Loan",
  closing: "Closing",
};
const STAGE_ORDER: TransactionStage[] = ["contract", "inspection", "appraisal", "loan", "closing"];

const COUNTERPARTY_LABELS: Record<CounterpartyRole, string> = {
  title: "Title / escrow",
  lender: "Lender",
  inspector: "Inspector",
  insurance: "Insurance",
  co_agent: "Co-agent / listing agent",
  other: "Other",
};
const COUNTERPARTY_ROLES: CounterpartyRole[] = [
  "title",
  "lender",
  "inspector",
  "insurance",
  "co_agent",
  "other",
];

function daysUntil(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const target = new Date(`${dateIso}T00:00:00Z`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function TransactionDetailClient({ initial }: { initial: Bundle }) {
  const [txn, setTxn] = useState<TransactionRow>(initial.transaction);
  const [tasks, setTasks] = useState<TransactionTaskRow[]>(initial.tasks);
  const [cps, setCps] = useState<TransactionCounterpartyRow[]>(initial.counterparties);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tasksByStage = useMemo(() => {
    const out = new Map<TransactionStage, TransactionTaskRow[]>();
    for (const s of STAGE_ORDER) out.set(s, []);
    for (const t of tasks) {
      const arr = out.get(t.stage) ?? [];
      arr.push(t);
      out.set(t.stage, arr);
    }
    return out;
  }, [tasks]);

  const totals = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let completed = 0;
    let overdue = 0;
    for (const t of tasks) {
      if (t.completed_at) completed += 1;
      else if (t.due_date && t.due_date < today) overdue += 1;
    }
    return { completed, total: tasks.length, overdue };
  }, [tasks]);

  async function patchTransaction(patch: Record<string, unknown>, fieldKey: string) {
    setSavingField(fieldKey);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/transactions/${txn.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        transaction?: TransactionRow;
        error?: string;
      };
      if (!res.ok || !body.ok || !body.transaction) {
        setError(body.error ?? "Save failed.");
        return;
      }
      setTxn(body.transaction);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSavingField(null);
    }
  }

  async function toggleTask(t: TransactionTaskRow) {
    const res = await fetch(`/api/dashboard/transactions/${txn.id}/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ completed: !t.completed_at }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; task?: TransactionTaskRow };
    if (res.ok && body.ok && body.task) {
      setTasks((prev) => prev.map((x) => (x.id === t.id ? body.task! : x)));
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs text-slate-500">
            <Link href="/dashboard/transactions" className="hover:underline">
              Transactions
            </Link>
            {" / "}
            <span>{txn.property_address}</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{txn.property_address}</h1>
          <div className="mt-1 text-sm text-slate-600">
            {initial.contactName ?? "—"}
            {txn.purchase_price ? (
              <>
                {" · "}
                <span>${txn.purchase_price.toLocaleString()}</span>
              </>
            ) : null}
            {" · "}
            <span className="capitalize">{txn.transaction_type.replace("_", " ")}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">
              Days to close
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {(() => {
                const d = daysUntil(txn.closing_date);
                if (d == null) return "—";
                if (d < 0) return `${-d}d past`;
                return `${d}d`;
              })()}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Tasks</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {totals.completed}/{totals.total}
            </div>
            {totals.overdue > 0 ? (
              <div className="mt-0.5 text-[11px] font-medium text-red-600">
                {totals.overdue} overdue
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* Listing-side surfaces: offers compare, weekly seller update
          toggle, and a link back to the listing presentation builder.
          Buyer-rep deals don't render these. */}
      {txn.transaction_type === "listing_rep" || txn.transaction_type === "dual" ? (
        <div className="grid gap-3 md:grid-cols-3">
          <Link
            href={`/dashboard/transactions/${txn.id}/offers`}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <div>
              <div className="text-sm font-semibold text-slate-900">
                📬 Offers on listing
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                Compare offers + net-to-seller.
              </div>
            </div>
            <span className="text-slate-400">→</span>
          </Link>
          <SellerUpdateToggle
            transaction={txn}
            onChange={(enabled) =>
              setTxn((prev) => ({ ...prev, seller_update_enabled: enabled } as TransactionRow))
            }
          />
          {/* Listing presentation builder lives at /dashboard/seller-presentation
              — quick jumpback for editing the pitch deck. */}
          <Link
            href="/dashboard/seller-presentation"
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <div>
              <div className="text-sm font-semibold text-slate-900">
                🎯 Listing presentation
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                Open the CMA + pitch builder.
              </div>
            </div>
            <span className="text-slate-400">→</span>
          </Link>
        </div>
      ) : null}

      {/* Cross-agent showing feedback — listing-side only. Agent sends a
          public form to buyer-agents who toured; responses aggregate here. */}
      {txn.transaction_type === "listing_rep" || txn.transaction_type === "dual" ? (
        <ListingFeedbackPanel transactionId={txn.id} />
      ) : null}

      {/* Playbooks — agent-applied curated checklists anchored to this
          transaction. Anchor date defaults to mutual acceptance when
          set, else today. */}
      <PlaybooksPanel
        anchorKind="transaction"
        anchorId={txn.id}
        defaultAnchorDate={txn.mutual_acceptance_date ?? undefined}
      />

      {/* AI deal review — only makes sense once the deal is closed.
          Panel handles its own loading / cache / regenerate flow. */}
      {txn.status === "closed" ? (
        <DealReviewPanel transactionId={txn.id} />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ── Left column — tasks by stage ── */}
        <div className="space-y-4">
          {STAGE_ORDER.map((stage) => {
            const stageTasks = tasksByStage.get(stage) ?? [];
            return (
              <StageBlock
                key={stage}
                stage={stage}
                tasks={stageTasks}
                transactionId={txn.id}
                onToggle={toggleTask}
                onAdd={(task) => setTasks((prev) => [...prev, task])}
                onDelete={(id) => setTasks((prev) => prev.filter((x) => x.id !== id))}
              />
            );
          })}
        </div>

        {/* ── Right column — key dates, counterparties, notes ── */}
        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Key dates</h2>
            <div className="mt-3 space-y-2 text-sm">
              <DateRow
                label="Mutual acceptance"
                value={txn.mutual_acceptance_date}
                onChange={(v) => patchTransaction({ mutual_acceptance_date: v }, "mutual")}
                saving={savingField === "mutual"}
                help="Setting this auto-fills contingency deadlines with CA defaults (17d inspection, 21d loan, 30d closing) unless already set."
              />
              <DateRow
                label="Inspection deadline"
                value={txn.inspection_deadline}
                onChange={(v) => patchTransaction({ inspection_deadline: v }, "inspection")}
                saving={savingField === "inspection"}
              />
              <DateRow
                label="Appraisal deadline"
                value={txn.appraisal_deadline}
                onChange={(v) => patchTransaction({ appraisal_deadline: v }, "appraisal")}
                saving={savingField === "appraisal"}
              />
              <DateRow
                label="Loan contingency"
                value={txn.loan_contingency_deadline}
                onChange={(v) => patchTransaction({ loan_contingency_deadline: v }, "loan")}
                saving={savingField === "loan"}
              />
              <DateRow
                label="Closing date"
                value={txn.closing_date}
                onChange={(v) => patchTransaction({ closing_date: v }, "closing")}
                saving={savingField === "closing"}
              />
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3">
              <label className="block text-[11px] font-medium text-slate-500">Status</label>
              <select
                value={txn.status}
                onChange={(e) => patchTransaction({ status: e.target.value }, "status")}
                disabled={savingField === "status"}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="closed">Closed</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
          </section>

          <CounterpartiesBlock
            transactionId={txn.id}
            counterparties={cps}
            onAdd={(cp) => setCps((prev) => [...prev, cp])}
            onDelete={(id) => setCps((prev) => prev.filter((x) => x.id !== id))}
          />

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Notes</h2>
            <textarea
              defaultValue={txn.notes ?? ""}
              onBlur={(e) => {
                const value = e.target.value.trim() || null;
                if (value !== (txn.notes ?? null)) {
                  void patchTransaction({ notes: value }, "notes");
                }
              }}
              rows={5}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Anything you need to remember about this deal…"
            />
            {savingField === "notes" ? (
              <div className="mt-1 text-[11px] text-slate-500">Saving…</div>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}

function DateRow({
  label,
  value,
  onChange,
  saving,
  help,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  saving: boolean;
  help?: string;
}) {
  const [draft, setDraft] = useState(value ?? "");
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs text-slate-600">{label}</label>
        {saving ? <span className="text-[10px] text-slate-400">saving…</span> : null}
      </div>
      <input
        type="date"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const v = draft || null;
          if (v !== value) onChange(v);
        }}
        className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      />
      {help ? <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{help}</p> : null}
    </div>
  );
}

function StageBlock({
  stage,
  tasks,
  transactionId,
  onToggle,
  onAdd,
  onDelete,
}: {
  stage: TransactionStage;
  tasks: TransactionTaskRow[];
  transactionId: string;
  onToggle: (t: TransactionTaskRow) => void;
  onAdd: (t: TransactionTaskRow) => void;
  onDelete: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");
  const stageCompleted = tasks.filter((t) => t.completed_at).length;

  async function submitAdd() {
    if (!newTitle.trim()) return;
    const res = await fetch(`/api/dashboard/transactions/${transactionId}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stage, title: newTitle, due_date: newDue || null }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; task?: TransactionTaskRow };
    if (res.ok && body.ok && body.task) {
      onAdd(body.task);
      setAdding(false);
      setNewTitle("");
      setNewDue("");
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{STAGE_LABELS[stage]}</h3>
          <p className="text-[11px] text-slate-500">
            {stageCompleted}/{tasks.length} complete
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          {adding ? "Cancel" : "+ Add task"}
        </button>
      </header>

      {adding ? (
        <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-3">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Task title"
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            autoFocus
          />
          <div className="mt-2 flex items-center gap-2">
            <input
              type="date"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => void submitAdd()}
              disabled={!newTitle.trim()}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      ) : null}

      <ul className="divide-y divide-slate-100">
        {tasks.length === 0 ? (
          <li className="px-5 py-4 text-xs text-slate-500">No tasks in this stage yet.</li>
        ) : (
          tasks.map((t) => (
            <li key={t.id} className="flex items-start gap-3 px-5 py-2.5">
              <input
                type="checkbox"
                checked={Boolean(t.completed_at)}
                onChange={() => onToggle(t)}
                className="mt-0.5 h-4 w-4 accent-slate-900"
              />
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div
                    className={`text-sm ${t.completed_at ? "text-slate-400 line-through" : "text-slate-800"}`}
                  >
                    {t.title}
                    {t.seed_key === "verify_wire_instructions" ? (
                      <span className="ml-2 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                        anti-fraud
                      </span>
                    ) : null}
                  </div>
                  <TaskDueBadge dueDate={t.due_date} completed={Boolean(t.completed_at)} />
                </div>
                {t.description ? (
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                    {t.description}
                  </p>
                ) : null}
              </div>
              {t.source === "custom" ? (
                <button
                  type="button"
                  title="Delete custom task"
                  onClick={async () => {
                    if (!confirm("Delete this custom task?")) return;
                    const res = await fetch(
                      `/api/dashboard/transactions/${transactionId}/tasks/${t.id}`,
                      { method: "DELETE" },
                    );
                    if (res.ok) onDelete(t.id);
                  }}
                  className="text-[10px] text-slate-400 hover:text-red-600"
                >
                  ✕
                </button>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function TaskDueBadge({ dueDate, completed }: { dueDate: string | null; completed: boolean }) {
  if (!dueDate) return null;
  const d = daysUntil(dueDate);
  if (d == null) return null;

  if (completed) {
    return <span className="text-[10px] text-slate-400">{dueDate}</span>;
  }
  if (d < 0) {
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
        {-d}d overdue
      </span>
    );
  }
  if (d <= 3) {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
        {d === 0 ? "today" : `${d}d`}
      </span>
    );
  }
  return <span className="text-[10px] text-slate-400">{dueDate}</span>;
}

function CounterpartiesBlock({
  transactionId,
  counterparties,
  onAdd,
  onDelete,
}: {
  transactionId: string;
  counterparties: TransactionCounterpartyRow[];
  onAdd: (cp: TransactionCounterpartyRow) => void;
  onDelete: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{
    role: CounterpartyRole;
    name: string;
    company: string;
    email: string;
    phone: string;
  }>({ role: "title", name: "", company: "", email: "", phone: "" });

  async function submit() {
    if (!form.name.trim()) return;
    const res = await fetch(`/api/dashboard/transactions/${transactionId}/counterparties`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      counterparty?: TransactionCounterpartyRow;
    };
    if (res.ok && body.ok && body.counterparty) {
      onAdd(body.counterparty);
      setAdding(false);
      setForm({ role: "title", name: "", company: "", email: "", phone: "" });
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Counterparties</h2>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          {adding ? "Cancel" : "+ Add"}
        </button>
      </header>

      {adding ? (
        <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as CounterpartyRole }))}
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          >
            {COUNTERPARTY_ROLES.map((r) => (
              <option key={r} value={r}>
                {COUNTERPARTY_LABELS[r]}
              </option>
            ))}
          </select>
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
          <input
            placeholder="Company (optional)"
            value={form.company}
            onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
          <input
            placeholder="Email (optional)"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
          <input
            placeholder="Phone (optional)"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!form.name.trim()}
            className="w-full rounded-lg bg-slate-900 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            Add counterparty
          </button>
        </div>
      ) : null}

      {counterparties.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          Title, lender, inspector, insurance — add them here so you don&apos;t hunt through texts.
        </p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {counterparties.map((cp) => (
            <li
              key={cp.id}
              className="group rounded-lg border border-slate-100 bg-slate-50/30 px-3 py-2"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">
                    {COUNTERPARTY_LABELS[cp.role]}
                  </div>
                  <div className="font-medium text-slate-900">{cp.name}</div>
                  {cp.company ? <div className="text-xs text-slate-600">{cp.company}</div> : null}
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`Remove ${cp.name}?`)) return;
                    const res = await fetch(
                      `/api/dashboard/transactions/${transactionId}/counterparties/${cp.id}`,
                      { method: "DELETE" },
                    );
                    if (res.ok) onDelete(cp.id);
                  }}
                  className="invisible text-[10px] text-slate-400 hover:text-red-600 group-hover:visible"
                >
                  ✕
                </button>
              </div>
              {cp.email || cp.phone ? (
                <div className="mt-1 text-xs text-slate-600">
                  {cp.email ? (
                    <a href={`mailto:${cp.email}`} className="underline hover:text-slate-900">
                      {cp.email}
                    </a>
                  ) : null}
                  {cp.email && cp.phone ? " · " : null}
                  {cp.phone ? (
                    <a href={`tel:${cp.phone}`} className="underline hover:text-slate-900">
                      {cp.phone}
                    </a>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Per-listing toggle for the weekly seller-update email. Clicks PATCH
 * the transaction, bubbles the new value back up via onChange.
 */
function SellerUpdateToggle({
  transaction,
  onChange,
}: {
  transaction: TransactionRow;
  onChange: (enabled: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  const enabled = transaction.seller_update_enabled;
  const lastSent = transaction.seller_update_last_sent_at;

  async function toggle() {
    setSaving(true);
    try {
      const next = !enabled;
      const res = await fetch(`/api/dashboard/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seller_update_enabled: next }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        transaction?: TransactionRow;
      };
      if (res.ok && body.ok && body.transaction) {
        onChange(body.transaction.seller_update_enabled);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900">
          📧 Weekly seller update
        </div>
        <div className="mt-0.5 text-xs text-slate-500">
          {enabled
            ? lastSent
              ? `On — last sent ${new Date(lastSent).toLocaleDateString()}`
              : "On — first send goes out Monday"
            : "Off — sellers get no weekly email"}
        </div>
      </div>
      <button
        type="button"
        onClick={() => void toggle()}
        role="switch"
        aria-checked={enabled}
        disabled={saving}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
          enabled ? "bg-slate-900" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
