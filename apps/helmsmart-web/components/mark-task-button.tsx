"use client";

import { useState, useTransition } from "react";
import { Sparkles, Check } from "lucide-react";
import { letMarkCreateTask } from "@/lib/actions/approvals";

export function MarkTaskButton() {
  const [status, setStatus] = useState<"idle" | "created" | "error">("idle");
  const [, startTransition] = useTransition();

  function ask() {
    startTransition(async () => {
      const res = await letMarkCreateTask();
      setStatus(res.status === "created" ? "created" : "error");
    });
  }

  if (status === "created") {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-700">
        <Check className="w-4 h-4" />
        <span>Task created — <a href="/tasks" className="underline font-medium">view it</a></span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={ask}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-lg hover:bg-indigo-100 transition-colors"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Ask Mark to create a task
      </button>
      {status === "error" && <p className="text-xs text-rose-500">Something went wrong.</p>}
    </div>
  );
}
