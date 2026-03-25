"use client";

import React, { useState } from "react";
import type { DraftReply, NextBestAction } from "@/lib/chat-assistant/types";
import { NextBestActionsPanel } from "./NextBestActionsPanel";
import { SuggestedRepliesList } from "./SuggestedRepliesList";

export function ChatAssistantPanel({
  leadId,
  onUseReply,
}: {
  leadId: string;
  onUseReply: (reply: { subject?: string | null; body: string }) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  const [sentiment, setSentiment] = useState<"hot" | "warm" | "cold" | null>(null);
  const [nextBestActions, setNextBestActions] = useState<NextBestAction[]>([]);
  const [suggestedReplies, setSuggestedReplies] = useState<DraftReply[]>([]);

  async function runAssistant() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/agent/chat-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        summary?: string;
        sentiment?: "hot" | "warm" | "cold";
        nextBestActions?: NextBestAction[];
        suggestedReplies?: DraftReply[];
      };
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to run assistant");
      setSummary(json.summary || "");
      setSentiment(json.sentiment || null);
      setNextBestActions(json.nextBestActions || []);
      setSuggestedReplies(json.suggestedReplies || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run assistant");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">AI Assistant</h2>
          <p className="mt-1 text-xs text-gray-500">
            Live guidance from conversation, lead source, Smart Match, listing, and valuation context.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runAssistant()}
          disabled={loading}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:bg-gray-300"
        >
          {loading ? "Analyzing..." : "Analyze Chat"}
        </button>
      </div>

      <div className="space-y-5 p-5">
        {error ? <div className="text-sm text-red-600">{error}</div> : null}

        {summary ? (
          <div className="rounded-xl border bg-gray-50 p-4">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-gray-900">Lead Summary</div>
              {sentiment ? (
                <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium capitalize text-gray-700">
                  {sentiment}
                </span>
              ) : null}
            </div>
            <div className="mt-2 text-sm text-gray-700">{summary}</div>
          </div>
        ) : null}

        <div>
          <div className="mb-3 text-sm font-semibold text-gray-900">Next Best Actions</div>
          <NextBestActionsPanel items={nextBestActions} />
        </div>

        <div>
          <div className="mb-3 text-sm font-semibold text-gray-900">Suggested Replies</div>
          <SuggestedRepliesList
            items={suggestedReplies}
            onUse={(item) => onUseReply({ subject: item.subject, body: item.body })}
          />
        </div>
      </div>
    </section>
  );
}
