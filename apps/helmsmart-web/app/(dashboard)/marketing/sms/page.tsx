import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { Plus, MessageCircle, TrendingUp } from "lucide-react";

export const metadata: Metadata = { title: "SMS Campaigns · Marketing" };

export default async function SMSCampaignsPage() {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value ?? "";
  const supabase = await createClient();

  const { data: campaigns } = await supabase
    .from("sms_campaigns")
    .select(
      `id, name, target_segment, status,
       total_recipients, delivered_count, click_count,
       scheduled_for, sent_at, created_at`
    )
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50);

  const draft = campaigns?.filter((c) => c.status === "draft") ?? [];
  const sent = campaigns?.filter((c) => c.status === "sent") ?? [];
  const scheduled = campaigns?.filter((c) => c.status === "scheduled") ?? [];

  const totalSent = sent.reduce((sum, c) => sum + (c.delivered_count ?? 0), 0);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">SMS Campaigns</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Reach customers with direct text messages
          </p>
        </div>
        <Link
          href="/marketing/sms/new"
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
          <p className="text-2xl font-bold text-slate-900 mt-2">{campaigns?.length ?? 0}</p>
        </div>
      </div>

      {/* Scheduled Campaigns */}
      {scheduled.length > 0 && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm font-medium text-blue-900 mb-3">
            {scheduled.length} scheduled campaign{scheduled.length !== 1 ? "s" : ""}
          </p>
          <div className="space-y-2">
            {scheduled.map((campaign) => (
              <div key={campaign.id} className="flex items-center justify-between text-sm">
                <span className="text-blue-800">{campaign.name}</span>
                <span className="text-blue-600">
                  {new Date(campaign.scheduled_for).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Draft Campaigns */}
      {draft.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Drafts ({draft.length})</h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {draft.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/marketing/sms/${campaign.id}`}
                className="flex items-center justify-between px-6 py-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{campaign.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Segment: {campaign.target_segment} · Created{" "}
                    {new Date(campaign.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
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

      {/* Sent Campaigns */}
      {sent.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Sent ({sent.length})</h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {sent.map((campaign) => (
              <div
                key={campaign.id}
                className="flex items-center justify-between px-6 py-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{campaign.name}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-600">
                    <span>{campaign.delivered_count?.toLocaleString() ?? 0} delivered</span>
                    {campaign.click_count ? (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {campaign.click_count} clicks
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">
                    {new Date(campaign.sent_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!campaigns || campaigns.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <MessageCircle className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">No campaigns yet</p>
          <p className="text-xs text-slate-400 mt-1 mb-5">
            Create your first SMS campaign to reach customers directly
          </p>
          <Link
            href="/marketing/sms/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Campaign
          </Link>
        </div>
      ) : null}
    </div>
  );
}
