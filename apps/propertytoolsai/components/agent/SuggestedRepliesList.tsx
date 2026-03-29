"use client";

import React from "react";
import type { DraftReply } from "@/lib/chat-assistant/types";

export function SuggestedRepliesList({
  items,
  onUse,
}: {
  items: DraftReply[];
  onUse: (item: DraftReply) => void;
}) {
  if (!items.length) {
    return <div className="text-sm text-gray-500">No reply suggestions yet.</div>;
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="rounded-xl border p-4">
          <div className="text-sm font-semibold text-gray-900">{item.label}</div>
          {item.subject ? (
            <div className="mt-2 text-xs text-gray-600">Subject: {item.subject}</div>
          ) : null}
          <div className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{item.body}</div>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => onUse(item)}
              className="rounded-lg border px-3 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50"
            >
              Use Reply
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
