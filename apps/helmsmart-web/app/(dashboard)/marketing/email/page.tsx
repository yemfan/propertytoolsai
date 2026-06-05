import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Mail, TrendingUp, Eye } from "lucide-react";
import { listEmailCampaigns } from "@/lib/actions/email-campaigns";

export const metadata: Metadata = { title: "Email Campaigns · Marketing" };

const STATUS_COLOR: Record<string, string> = {
  draft:     "bg-slate-100 text-slate-600",
  scheduled: "bg-blue-100 text-blue-700",
  sending:   "bg-amber-100 text-amber-700",
  sent:      "bg-emerald-100 text-emerald-700",
  failed:    "bg-rose-100 text-rose-700",
};

function pct(a: number, b: number) {
  if (!b) return "—";
  return `${((a / b) * 100).toFixed(0)}%`;
}

export default async function EmailCampaignsPage() {
  const campaigns = await listEmailCampaigns();

  const draft     = campaigns.filter((c) => c.status === "draft");
  const scheduled = campaigns.filter((c) => c.status === "scheduled");
  const sent      = campaigns.filter((c) => c.status === "sent");
  const totalSent = sent.reduce((s, c) => s + (c.delivered_count ?? 0), 0);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Email Campaigns</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Send newsletters and marketing emails to your clients
          </p>
        </div>
        <Link
          href="/marketing/email/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-600 uppercase">Total Sent</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{totalSent.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-600 uppercase">Drafts</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{draft.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-600 uppercase">Campaigns</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{campaigns.length}</p>
        </div>
      </div>

      {/* Scheduled */}
      {scheduled.length > 0 && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm font-medium text-blue-900 mb-2">
            {scheduled.length} scheduled campaign{scheduled.length !== 1 ? "s" : ""}
          </p>
          {scheduled.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-sm">
              <span className="text-blue-800">{c.name}</span>
              <span className="text-blue-600">
                {new Date(c.scheduled_for!).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Drafts */}
      {draft.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Drafts ({draft.length})</h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {draft.map((c) => (
              <Link
                key={c.id}
                href={`/marketing/email/${c.id}`}
                className="flex items-center justify-between px-6 py-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
              >
                <div>
                  <p className="font-medium text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Subject: {c.subject} · Segment: {c.target_segment}
                  </p>
                </div>
                <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-700 rounded">
                  Draft
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Sent */}
      {sent.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Sent ({sent.length})</h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {sent.map((c) => (
              <Link
                key={c.id}
                href={`/marketing/email/${c.id}`}
                className="flex items-center gap-4 px-6 py-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{c.subject}</p>
                </div>
                <div className="flex items-center gap-5 text-xs text-slate-600">
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    {(c.delivered_count ?? 0).toLocaleString()} delivered
                  </span>
                  {(c.open_count ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      {pct(c.open_count ?? 0, c.delivered_count ?? 0)} open rate
                    </span>
                  )}
                  {(c.click_count ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      {pct(c.click_count ?? 0, c.delivered_count ?? 0)} CTR
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 flex-shrink-0">
                  {new Date(c.sent_at!).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {campaigns.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Mail className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">No campaigns yet</p>
          <p className="text-xs text-slate-400 mt-1 mb-5">
            Create an email campaign to reach your clients with news, offers, or updates
          </p>
          <Link
            href="/marketing/email/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Campaign
          </Link>
        </div>
      )}
    </div>
  );
}
