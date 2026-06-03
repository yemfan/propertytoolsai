"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { createTask } from "@/lib/actions/tasks";

interface Client {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
}

interface Props {
  clients?: Client[];
  preselectedClientId?: string;
  label?: string;
}

type Priority = "low" | "normal" | "high" | "urgent";

function defaultDue(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export function AddTaskModal({ clients = [], preselectedClientId, label }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState(defaultDue());
  const [clientId, setClientId] = useState(preselectedClientId ?? "");
  const [priority, setPriority] = useState<Priority>("normal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setTitle("");
    setNotes("");
    setDueDate(defaultDue());
    setClientId(preselectedClientId ?? "");
    setPriority("normal");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required"); return; }
    setLoading(true);
    setError("");
    try {
      await createTask({
        title: title.trim(),
        notes: notes.trim() || undefined,
        due_date: dueDate || undefined,
        client_id: clientId || undefined,
        priority,
      });
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        {label ?? "Add task"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">New Task</h2>
              <button
                onClick={() => { setOpen(false); reset(); }}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Task
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Due date + Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Due date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Client */}
              {clients.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Client{" "}
                    <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">No client</option>
                    {clients.map((c) => {
                      const name =
                        [c.first_name, c.last_name].filter(Boolean).join(" ") ||
                        c.company ||
                        c.id;
                      return (
                        <option key={c.id} value={c.id}>
                          {name}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Notes{" "}
                  <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Any additional context…"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {error && (
                <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setOpen(false); reset(); }}
                  className="flex-1 py-2.5 text-sm font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                >
                  {loading ? "Saving…" : "Create task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
