"use client";

import React, { useState } from "react";
import type { SuggestedReply } from "@/lib/ai-reply/types";

export function AIReplyAssistant({
  leadId,
  onUseSuggestion,
}: {
  leadId: string;
  onUseSuggestion: (suggestion: { subject?: string | null; body: string }) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [reasoning, setReasoning] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestedReply[]>([]);
  const [error, setError] = useState("");

  async function generate() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/agent/leads/ai-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to generate replies");
      setReasoning(json.reasoningSummary || "");
      setSuggestions(json.suggestions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate replies");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">AI Reply Assistant</h2>
          <p className="mt-1 text-xs text-gray-500">
            Generate fast, context-aware replies for this lead.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={loading}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:bg-gray-300"
        >
          {loading ? "Generating..." : "Generate Replies"}
        </button>
      </div>

      <div className="space-y-4 p-5">
        {error ? <div className="text-sm text-red-600">{error}</div> : null}

        {reasoning ? (
          <div className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-700">{reasoning}</div>
        ) : null}

        {!suggestions.length ? (
          <div className="text-sm text-gray-500">No suggestions yet.</div>
        ) : (
          suggestions.map((item, index) => (
            <div key={`${item.label}-${index}`} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">{item.label}</span>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs capitalize text-gray-700">
                  {item.tone}
                </span>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs capitalize text-gray-700">
                  {item.goal.replaceAll("_", " ")}
                </span>
              </div>

              {item.subject ? (
                <div className="mt-3 text-sm">
                  <span className="font-medium text-gray-900">Subject: </span>
                  <span className="text-gray-700">{item.subject}</span>
                </div>
              ) : null}

              <div className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{item.body}</div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => onUseSuggestion({ subject: item.subject, body: item.body })}
                  className="rounded-lg border px-3 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50"
                >
                  Use This Reply
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
