"use client";

import React from "react";
import type { NextBestAction } from "@/lib/chat-assistant/types";

function badgeClass(priority: NextBestAction["priority"]) {
  if (priority === "high") return "bg-red-50 text-red-700";
  if (priority === "medium") return "bg-amber-50 text-amber-700";
  return "bg-gray-100 text-gray-700";
}

export function NextBestActionsPanel({ items }: { items: NextBestAction[] }) {
  if (!items.length) {
    return <div className="text-sm text-gray-500">No suggested actions yet.</div>;
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="rounded-xl border p-4">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-gray-900">{item.label}</div>
            <span
              className={`rounded-full px-2 py-1 text-[11px] font-medium ${badgeClass(item.priority)}`}
            >
              {item.priority}
            </span>
          </div>
          <div className="mt-2 text-sm text-gray-700">{item.reason}</div>
          <div className="mt-1 text-xs text-gray-500 capitalize">
            {item.actionType.replaceAll("_", " ")}
          </div>
        </div>
      ))}
    </div>
  );
}
