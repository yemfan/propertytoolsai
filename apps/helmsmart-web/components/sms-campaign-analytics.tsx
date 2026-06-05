"use client";

import Link from "next/link";
import {
  ArrowLeft, Users, CheckCircle2, XCircle, TrendingUp, MessageCircle,
} from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  message_text: string;
  target_segment: string;
  status: string;
  total_recipients: number | null;
  delivered_count: number | null;
  failed_count: number | null;
  unsubscribe_count: number | null;
  click_count: number | null;
  sent_at: string | null;
}

interface Recipient {
  id: string;
  recipient_name?: string;
  recipient_email?: string;
  phone_number: string;
  sent_at?: string;
  delivered_at?: string;
  failed_at?: string;
  failure_reason?: string;
  unsubscribed_at?: string;
}

interface Props {
  campaign: Campaign;
  recipients: Recipient[];
}

export function SMSCampaignAnalytics({ campaign, recipients }: Props) {
  const total = campaign.total_recipients ?? 0;
  const delivered = campaign.delivered_count ?? 0;
  const failed = campaign.failed_count ?? 0;
  const unsubscribed = campaign.unsubscribe_count ?? 0;
  const deliveryRate = total > 0 ? ((delivered / total) * 100).toFixed(1) : "—";

  const delivered_recipients = recipients.filter((r) => r.delivered_at);
  const failed_recipients = recipients.filter((r) => r.failed_at);
  const unsubscribed_recipients = recipients.filter((r) => r.unsubscribed_at);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/marketing/sms"
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{campaign.name}</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Sent{" "}
            {campaign.sent_at
              ? new Date(campaign.sent_at).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </p>
        </div>
        <span className="ml-2 text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full capitalize">
          {campaign.status}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Recipients",
            value: total.toLocaleString(),
            icon: Users,
            color: "text-slate-600",
            bg: "bg-slate-50",
          },
          {
            label: "Delivered",
            value: `${delivered.toLocaleString()} (${deliveryRate}%)`,
            icon: CheckCircle2,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
          },
          {
            label: "Failed",
            value: failed.toLocaleString(),
            icon: XCircle,
            color: "text-rose-600",
            bg: "bg-rose-50",
          },
          {
            label: "Unsubscribed",
            value: unsubscribed.toLocaleString(),
            icon: TrendingUp,
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`rounded-xl border border-slate-200 ${bg} p-5`}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                {label}
              </span>
            </div>
            <p className="text-xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Message preview */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">Message Sent</h2>
          <span className="text-xs text-slate-400 ml-auto">
            {campaign.target_segment} · {Math.ceil(campaign.message_text.length / 160)} SMS part
            {Math.ceil(campaign.message_text.length / 160) > 1 ? "s" : ""}
          </span>
        </div>
        <div className="max-w-xs">
          <div className="bg-emerald-500 text-white text-sm rounded-2xl rounded-br-sm px-4 py-2.5 leading-relaxed inline-block">
            {campaign.message_text}
          </div>
        </div>
      </div>

      {/* Recipient table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">
            Recipients ({recipients.length})
          </h2>
          <div className="flex gap-2 text-xs">
            <span className="text-emerald-600 font-medium">{delivered_recipients.length} delivered</span>
            {failed_recipients.length > 0 && (
              <span className="text-rose-600 font-medium ml-2">
                {failed_recipients.length} failed
              </span>
            )}
          </div>
        </div>

        {recipients.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            No recipient data available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Recipient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Sent at
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recipients.map((r) => {
                  const status = r.unsubscribed_at
                    ? { label: "Unsubscribed", color: "bg-amber-100 text-amber-700" }
                    : r.failed_at
                      ? { label: "Failed", color: "bg-rose-100 text-rose-700" }
                      : r.delivered_at
                        ? { label: "Delivered", color: "bg-emerald-100 text-emerald-700" }
                        : { label: "Sent", color: "bg-blue-100 text-blue-700" };

                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3">
                        <p className="font-medium text-slate-800">
                          {r.recipient_name || "—"}
                        </p>
                        {r.recipient_email && (
                          <p className="text-xs text-slate-400">{r.recipient_email}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                        {r.phone_number}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}
                        >
                          {status.label}
                        </span>
                        {r.failure_reason && (
                          <p className="text-xs text-rose-500 mt-0.5">{r.failure_reason}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {r.sent_at
                          ? new Date(r.sent_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
