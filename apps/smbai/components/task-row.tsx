"use client";

import { useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Trash2, Building2 } from "lucide-react";
import { updateTaskStatus, deleteTask } from "@/lib/actions/tasks";

interface Task {
  id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  status: "open" | "in_progress" | "done" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  clients: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
  } | Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
  }> | null;
}

interface Props {
  task: Task;
}

const PRIORITY_STYLES: Record<string, string> = {
  low:    "text-slate-400",
  normal: "text-slate-500",
  high:   "text-amber-600",
  urgent: "text-rose-600 font-semibold",
};

const PRIORITY_DOT: Record<string, string> = {
  low:    "bg-slate-300",
  normal: "bg-slate-400",
  high:   "bg-amber-400",
  urgent: "bg-rose-500",
};

function fmtDate(d: string): string {
  const date = new Date(d + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((date.getTime() - today.getTime()) / 86400000);

  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff <= 7) return `${diff}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TaskRow({ task }: Props) {
  const [isPending, startTransition] = useTransition();

  const isDone = task.status === "done" || task.status === "cancelled";

  const clientRaw = task.clients;
  const client = Array.isArray(clientRaw) ? clientRaw[0] : clientRaw;
  const clientName = client
    ? [client.first_name, client.last_name].filter(Boolean).join(" ") ||
      client.company
    : null;

  const isOverdue =
    !isDone &&
    task.due_date &&
    new Date(task.due_date + "T00:00:00") < new Date(new Date().setHours(0, 0, 0, 0));

  function handleToggle() {
    startTransition(() => {
      updateTaskStatus(task.id, isDone ? "open" : "done");
    });
  }

  function handleDelete() {
    if (!window.confirm("Delete this task?")) return;
    startTransition(() => {
      deleteTask(task.id);
    });
  }

  return (
    <div
      className={`flex items-start gap-3 px-5 py-3.5 group hover:bg-slate-50 transition-colors ${
        isPending ? "opacity-50" : ""
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={handleToggle}
        disabled={isPending}
        className="mt-0.5 flex-shrink-0 text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-40"
      >
        {isDone ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        ) : (
          <Circle className="w-5 h-5" />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm ${
              isDone ? "line-through text-slate-400" : "text-slate-800 font-medium"
            }`}
          >
            {task.title}
          </span>
          {/* Priority dot */}
          <span
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority] ?? "bg-slate-400"}`}
            title={`Priority: ${task.priority}`}
          />
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-0.5">
          {clientName && client && (
            <Link
              href={`/clients/${client.id}`}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Building2 className="w-3 h-3" />
              {clientName}
            </Link>
          )}
          {task.due_date && (
            <span
              className={`text-xs ${
                isOverdue ? "text-rose-600 font-medium" : "text-slate-400"
              }`}
            >
              {fmtDate(task.due_date)}
            </span>
          )}
          {task.notes && (
            <span className="text-xs text-slate-400 truncate max-w-48">
              {task.notes}
            </span>
          )}
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="flex-shrink-0 p-1 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-40"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
