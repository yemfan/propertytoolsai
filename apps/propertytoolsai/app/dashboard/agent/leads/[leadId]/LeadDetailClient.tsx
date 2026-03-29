"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AIReplyAssistant } from "@/components/agent/AIReplyAssistant";
import { ChatAssistantPanel } from "@/components/agent/ChatAssistantPanel";
import { LeadScoreBadge } from "@/components/agent/LeadScoreBadge";
import { DealPredictionCard } from "@/components/agent/DealPredictionCard";
import { LeadConversationPanel } from "./LeadConversationPanel";
import { LeadFollowupTimeline } from "./LeadFollowupTimeline";

type LeadDetailResponse = {
  success: true;
  lead: any;
  report: any;
  followups: any[];
  notifications: any[];
  conversations: any[];
};

function money(value?: number) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function LeadDetailClient() {
  const params = useParams<{ leadId: string }>();
  const leadId = params.leadId;

  const [data, setData] = useState<LeadDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [composerSeed, setComposerSeed] = useState<{
    subject: string;
    message: string;
    key: number;
  } | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/agent/leads/${leadId}`, { cache: "no-store" });
    const json = await res.json();
    if (json?.success) setData(json);
    setLoading(false);
  }

  async function pauseSequence() {
    setBusy(true);
    await fetch("/api/agent/leads/pause-sequence", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ leadId }),
    });
    await load();
    setBusy(false);
  }

  useEffect(() => {
    if (leadId) {
      void load();
    }
  }, [leadId]);

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading lead...</div>;
  }

  if (!data) {
    return <div className="p-6 text-sm text-red-600">Lead not found.</div>;
  }

  const { lead, report, followups, notifications, conversations } = data;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-gray-900">{lead.name}</h1>
              <p className="mt-2 text-sm text-gray-600">{lead.address}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <LeadScoreBadge
                  score={typeof lead.lead_score === "number" ? lead.lead_score : lead.engagement_score ?? 0}
                  temperature={
                    typeof lead.lead_temperature === "string" && lead.lead_temperature
                      ? lead.lead_temperature
                      : "cold"
                  }
                />
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                  {lead.status}
                </span>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                  {lead.intent}
                </span>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                  Engagement {lead.engagement_score ?? 0}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void pauseSequence()}
                disabled={busy}
                className="rounded-2xl border px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:bg-gray-100"
              >
                {busy ? "Pausing..." : "Pause Sequence"}
              </button>
              <button
                type="button"
                className="rounded-2xl bg-gray-900 px-4 py-3 text-sm font-medium text-white"
              >
                Contact Lead
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">Lead Summary</h2>
            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <div>Email: {lead.email || "—"}</div>
              <div>Phone: {lead.phone || "—"}</div>
              <div>Source: {lead.source || "—"}</div>
              <div>Conversation Status: {lead.conversation_status || "—"}</div>
              <div>Last Contact: {lead.last_contact_at || "—"}</div>
              <div>Last Reply: {lead.last_reply_at || "—"}</div>
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">Valuation Report</h2>
            {report ? (
              <div className="mt-4 space-y-3 text-sm text-gray-700">
                <div>Estimated Value: {money(report.estimate_value)}</div>
                <div>
                  Range: {money(report.range_low)} - {money(report.range_high)}
                </div>
                <div>Confidence: {report.confidence}</div>
                <div>
                  PDF:{" "}
                  {report.pdf_url ? (
                    <a href={report.pdf_url} className="text-blue-600 underline">
                      Open Report
                    </a>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-gray-500">No report found.</div>
            )}
          </section>
        </div>

        <DealPredictionCard
          key={String(lead.prediction_updated_at ?? lead.id)}
          leadId={String(lead.id)}
          initial={{
            closeProbability:
              lead.close_probability != null && lead.close_probability !== ""
                ? Number(lead.close_probability)
                : undefined,
            predictedDealValue:
              lead.predicted_deal_value != null && lead.predicted_deal_value !== ""
                ? Number(lead.predicted_deal_value)
                : undefined,
            predictedCloseWindow: lead.predicted_close_window ?? null,
            factors: Array.isArray(lead.prediction_factors_json) ? lead.prediction_factors_json : undefined,
          }}
        />

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <AIReplyAssistant
              leadId={leadId}
              onUseSuggestion={(suggestion) => {
                setComposerSeed({
                  subject: suggestion.subject ?? "",
                  message: suggestion.body,
                  key: Date.now(),
                });
              }}
            />
            <ChatAssistantPanel
              leadId={leadId}
              onUseReply={(reply) => {
                setComposerSeed({
                  subject: reply.subject ?? "",
                  message: reply.body,
                  key: Date.now(),
                });
              }}
            />
            <LeadConversationPanel
              leadId={leadId}
              items={conversations}
              onSent={load}
              composerSeed={composerSeed}
            />
          </div>

          <section className="space-y-6">
            <LeadFollowupTimeline
              items={followups}
              onChanged={load}
            />

            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">Notifications</h2>
              <div className="mt-4 space-y-3">
                {notifications.length === 0 ? (
                  <div className="text-sm text-gray-500">No notifications found.</div>
                ) : (
                  notifications.map((item) => (
                    <div key={item.id} className="rounded-xl border p-4">
                      <div className="font-medium text-gray-900">{item.title}</div>
                      <div className="mt-1 text-sm text-gray-700">{item.message}</div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </section>
        </div>
      </div>
    </div>
  );
}
