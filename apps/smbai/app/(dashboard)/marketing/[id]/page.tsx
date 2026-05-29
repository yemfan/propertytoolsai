import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { CampaignDetailActions } from "./campaign-detail-actions";
import {
  ArrowLeft, Mail, CheckCircle2, Clock, XCircle, Send,
} from "lucide-react";

export const metadata: Metadata = { title: "Campaign · Marketing" };

const STATUS_CONFIG = {
  draft:   { label: "Draft",   color: "bg-slate-100 text-slate-600",     icon: Mail },
  sending: { label: "Sending", color: "bg-blue-100 text-blue-700",       icon: Clock },
  sent:    { label: "Sent",    color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  failed:  { label: "Failed",  color: "bg-rose-100 text-rose-700",       icon: XCircle },
} as const;

const SEGMENT_LABELS: Record<string, string> = {
  all:       "All clients",
  active:    "Active clients",
  leads:     "Leads",
  prospects: "Prospects",
  inactive:  "Inactive clients",
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value ?? "";
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("organization_id", orgId)
    .single();

  if (!campaign) notFound();

  const cfg =
    STATUS_CONFIG[campaign.status as keyof typeof STATUS_CONFIG] ??
    STATUS_CONFIG.draft;
  const StatusIcon = cfg.icon;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold text-slate-900">
              {campaign.name}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}
            >
              <StatusIcon className="w-3 h-3" />
              {cfg.label}
            </span>
          </div>
          <p className="text-sm text-slate-500">{campaign.subject}</p>
        </div>
        <Link
          href="/marketing"
          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Campaigns
        </Link>
      </div>

      <div className="grid grid-cols-[1fr_260px] gap-6">
        {/* Left: campaign body */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
              Message preview
            </h2>
            <div className="border border-slate-100 rounded-lg overflow-hidden">
              {/* Email header mock */}
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-100">
                <p className="text-xs text-slate-500">
                  <span className="font-medium">Subject:</span> {campaign.subject}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  <span className="font-medium">To:</span>{" "}
                  {SEGMENT_LABELS[campaign.recipient_filter] ?? campaign.recipient_filter}
                </p>
              </div>
              <div className="px-4 py-4 space-y-2">
                <p className="text-sm text-slate-600">Hi [client name],</p>
                {campaign.body.split("\n").map((line: string, i: number) =>
                  line.trim() ? (
                    <p key={i} className="text-sm text-slate-700 leading-relaxed">
                      {line}
                    </p>
                  ) : (
                    <div key={i} className="h-1" />
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: stats + actions */}
        <div className="space-y-4">
          {/* Stats */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Campaign stats
            </h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Segment</dt>
                <dd className="font-medium text-slate-800">
                  {SEGMENT_LABELS[campaign.recipient_filter] ??
                    campaign.recipient_filter}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Recipients</dt>
                <dd className="font-medium text-slate-800 tabular-nums">
                  {campaign.recipient_count ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}
                  >
                    <StatusIcon className="w-3 h-3" />
                    {cfg.label}
                  </span>
                </dd>
              </div>
              {campaign.sent_at && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Sent</dt>
                  <dd className="text-slate-800">
                    {new Date(campaign.sent_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-500">Created</dt>
                <dd className="text-slate-800">
                  {new Date(campaign.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </dd>
              </div>
            </dl>
          </div>

          {/* Actions */}
          <CampaignDetailActions
            campaignId={campaign.id}
            status={campaign.status}
          />
        </div>
      </div>
    </div>
  );
}
