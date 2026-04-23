"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PlaybookAnchor } from "@/lib/playbooks/definitions";
import type { PlaybookTaskRow } from "@/lib/playbooks/types";

type PlaybookMeta = {
  key: string;
  category: string;
  title: string;
  description: string;
  validAnchors: PlaybookAnchor[];
  anchorHint: string;
  itemCount: number;
};

/**
 * Reusable playbook panel — drops onto any detail page. Shows tasks
 * for this anchor grouped by (section) within (applied playbook
 * batch). Lets the agent apply a new playbook, tick items, and
 * remove the whole batch if they applied one by mistake.
 *
 * Props:
 *   - anchorKind / anchorId: what this panel is anchored to
 *   - defaultAnchorDate: YYYY-MM-DD to pre-fill in the apply modal
 *                        (transaction's mutual_acceptance, open
 *                        house's start_at, etc.)
 */
export function PlaybooksPanel({
  anchorKind,
  anchorId,
  defaultAnchorDate,
}: {
  anchorKind: PlaybookAnchor;
  anchorId: string | null;
  defaultAnchorDate?: string;
}) {
  const [tasks, setTasks] = useState<PlaybookTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        anchorKind,
        anchorId: anchorId ?? "null",
      });
      const res = await fetch(`/api/dashboard/playbooks?${params.toString()}`);
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        tasks?: PlaybookTaskRow[];
        error?: string;
      } | null;
      if (!res.ok || !body?.ok || !Array.isArray(body.tasks)) {
        setError(body?.error ?? "Failed to load tasks.");
        return;
      }
      setTasks(body.tasks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setLoading(false);
    }
  }, [anchorKind, anchorId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleTask(task: PlaybookTaskRow, completed: boolean) {
    // Optimistic
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, completed_at: completed ? new Date().toISOString() : null }
          : t,
      ),
    );
    try {
      const res = await fetch(`/api/dashboard/playbooks/${task.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      if (!res.ok) throw new Error("Save failed");
    } catch {
      // Rollback on failure
      await load();
    }
  }

  async function deleteBatch(batchId: string) {
    if (!confirm("Remove every task in this playbook?")) return;
    await fetch(`/api/dashboard/playbooks/batch/${batchId}`, { method: "DELETE" });
    await load();
  }

  const { batches, open, done } = useMemo(() => groupTasks(tasks), [tasks]);

  if (loading && !tasks.length) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">📋 Playbooks</h2>
        <p className="mt-2 text-xs text-slate-500">Loading tasks…</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">📋 Playbooks</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Apply a curated checklist to stay on track. Tick items as you go.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {open > 0 ? (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-800">
              {open} open
            </span>
          ) : null}
          {done > 0 ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-800">
              {done} done
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            + Apply playbook
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
      ) : null}

      {batches.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No playbooks applied yet. Click &quot;Apply playbook&quot; to pick one.
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          {batches.map((batch) => (
            <div
              key={batch.batchId ?? "ad-hoc"}
              className="rounded-lg border border-slate-200"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                <div className="text-xs font-semibold text-slate-700">
                  {batch.label}
                  <span className="ml-2 font-normal text-slate-500">
                    · {batch.done}/{batch.total} done
                  </span>
                </div>
                {batch.batchId ? (
                  <button
                    type="button"
                    onClick={() => void deleteBatch(batch.batchId!)}
                    className="text-[11px] text-slate-500 hover:text-red-600"
                  >
                    Remove playbook
                  </button>
                ) : null}
              </div>
              <div className="divide-y divide-slate-100">
                {batch.sections.map((section) => (
                  <div key={section.label} className="px-3 py-2">
                    {section.label !== "__none__" ? (
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {section.label}
                      </div>
                    ) : null}
                    <ul className="space-y-1">
                      {section.items.map((t) => {
                        const complete = t.completed_at != null;
                        return (
                          <li key={t.id} className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={complete}
                              onChange={(e) => void toggleTask(t, e.target.checked)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300"
                            />
                            <div className="flex-1">
                              <div
                                className={`text-sm ${
                                  complete
                                    ? "text-slate-400 line-through"
                                    : "text-slate-900"
                                }`}
                              >
                                {t.title}
                              </div>
                              {t.notes ? (
                                <div className="text-[11px] text-slate-500">{t.notes}</div>
                              ) : null}
                              {t.due_date ? (
                                <div
                                  className={`mt-0.5 text-[11px] ${
                                    !complete && isOverdue(t.due_date)
                                      ? "font-medium text-red-600"
                                      : "text-slate-400"
                                  }`}
                                >
                                  Due {formatYmd(t.due_date)}
                                </div>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showPicker ? (
        <PlaybookPickerModal
          anchorKind={anchorKind}
          anchorId={anchorId}
          defaultAnchorDate={defaultAnchorDate}
          onClose={() => setShowPicker(false)}
          onApplied={() => {
            setShowPicker(false);
            void load();
          }}
        />
      ) : null}
    </section>
  );
}

function PlaybookPickerModal({
  anchorKind,
  anchorId,
  defaultAnchorDate,
  onClose,
  onApplied,
}: {
  anchorKind: PlaybookAnchor;
  anchorId: string | null;
  defaultAnchorDate?: string;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [playbooks, setPlaybooks] = useState<PlaybookMeta[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [anchorDate, setAnchorDate] = useState<string>(
    defaultAnchorDate ?? todayYmd(),
  );
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/dashboard/playbooks");
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        playbooks?: PlaybookMeta[];
      } | null;
      if (!cancelled && body?.ok && Array.isArray(body.playbooks)) {
        setPlaybooks(body.playbooks.filter((p) => p.validAnchors.includes(anchorKind)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [anchorKind]);

  async function apply() {
    if (!selected) return;
    setError(null);
    setApplying(true);
    try {
      const res = await fetch("/api/dashboard/playbooks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateKey: selected,
          anchorKind,
          anchorId,
          anchorDate,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !body.ok) {
        setError(body.error ?? "Failed to apply.");
        return;
      }
      onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setApplying(false);
    }
  }

  const selectedPlaybook = playbooks.find((p) => p.key === selected) ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Apply playbook</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Pick a curated checklist. Tasks will be scheduled relative to your anchor date.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 grid max-h-[400px] gap-2 overflow-y-auto">
          {playbooks.length === 0 ? (
            <p className="text-sm text-slate-500">No playbooks available for this anchor.</p>
          ) : (
            playbooks.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setSelected(p.key)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  selected === p.key
                    ? "border-slate-900 bg-slate-900/5"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">{p.title}</div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                    {p.itemCount} tasks
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">{p.description}</p>
              </button>
            ))
          )}
        </div>

        {selectedPlaybook ? (
          <div className="mt-4 rounded-lg bg-slate-50 p-3">
            <label className="block text-xs font-medium text-slate-700">
              {selectedPlaybook.anchorHint} *
            </label>
            <input
              type="date"
              value={anchorDate}
              onChange={(e) => setAnchorDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Each task&apos;s due date is offset from this anchor (e.g. &quot;7 days before&quot;).
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        ) : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void apply()}
            disabled={!selected || applying}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {applying ? "Applying…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

type GroupedBatch = {
  batchId: string | null;
  label: string;
  total: number;
  done: number;
  sections: Array<{ label: string; items: PlaybookTaskRow[] }>;
};

function groupTasks(tasks: PlaybookTaskRow[]): {
  batches: GroupedBatch[];
  open: number;
  done: number;
} {
  let openCount = 0;
  let doneCount = 0;
  for (const t of tasks) {
    if (t.completed_at) doneCount++;
    else openCount++;
  }

  // Group by batch, then by section within each batch
  const byBatch = new Map<string, PlaybookTaskRow[]>();
  for (const t of tasks) {
    const k = t.apply_batch_id ?? "ad-hoc";
    const list = byBatch.get(k) ?? [];
    list.push(t);
    byBatch.set(k, list);
  }

  const batches: GroupedBatch[] = [];
  byBatch.forEach((items, key) => {
    const first = items[0];
    const sections = new Map<string, PlaybookTaskRow[]>();
    for (const it of items) {
      const sec = it.section ?? "__none__";
      const list = sections.get(sec) ?? [];
      list.push(it);
      sections.set(sec, list);
    }
    const total = items.length;
    const done = items.filter((x) => x.completed_at).length;
    batches.push({
      batchId: first.apply_batch_id,
      label: labelFor(first.template_key),
      total,
      done,
      sections: Array.from(sections.entries()).map(([label, items]) => ({ label, items })),
    });
    void key;
  });
  // Most-recent batch first (by first task created_at)
  batches.sort((a, b) => {
    const ta = a.sections[0]?.items[0]?.created_at ?? "";
    const tb = b.sections[0]?.items[0]?.created_at ?? "";
    return tb.localeCompare(ta);
  });
  return { batches, open: openCount, done: doneCount };
}

function labelFor(templateKey: string | null): string {
  const labels: Record<string, string> = {
    write_offer: "Write an offer",
    host_open_house: "Host an open house",
    seller_presentation: "Seller presentation",
    listing_launch: "Listing launch",
  };
  if (!templateKey) return "Ad-hoc tasks";
  return labels[templateKey] ?? templateKey;
}

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function formatYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isOverdue(ymd: string): boolean {
  return ymd < todayYmd();
}
