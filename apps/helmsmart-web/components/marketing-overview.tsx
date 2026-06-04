"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import { Phone, MessageSquare, Mail, Settings, ArrowRight, CheckCircle2, Plus } from "lucide-react";

type Channel = "voice" | "sms" | "email";

interface Props {
  voice: { configured: boolean; callsHandled: number };
  sms: { active: boolean; number: string | null };
  email: { sent: number; reached: number };
}

const TABS: { key: Channel; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { key: "voice", label: "Voice", icon: Phone },
  { key: "sms", label: "SMS", icon: MessageSquare },
  { key: "email", label: "Email", icon: Mail },
];

// The active channel's "create new" action, shown in the tab bar (changes per tab).
const CREATE: Record<Channel, { label: string; href: string }> = {
  voice: { label: "New call campaign", href: "/client-assistant" },
  sms:   { label: "Set up text-back",  href: "/settings#operations" },
  email: { label: "New campaign",      href: "/marketing/new" },
};

/**
 * Marketing Overview — a multi-channel control panel. One tab per outreach channel
 * (Voice / SMS / Email); each shows how to SET UP the channel and a MONITOR snapshot,
 * with links into the existing config + activity views.
 */
export function MarketingOverview({ voice, sms, email }: Props) {
  const [tab, setTab] = useState<Channel>("voice");

  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">Overview</h2>
      <div className="bg-white rounded-xl border border-slate-200">
        {/* Channel tabs + the active channel's "create new" action */}
        <div className="flex items-center justify-between border-b border-slate-100 pr-3">
          <div className="flex">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === key
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
          <Link
            href={CREATE[tab].href}
            className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {CREATE[tab].label}
          </Link>
        </div>

        {/* Tab content */}
        <div className="p-6">
          {tab === "voice" && (
            <div className="grid sm:grid-cols-2 gap-4">
              <SetupCard
                title="Set up virtual calls"
                desc="Let the AI place and answer calls for you — book appointments, run reminders, follow up with contacts."
                ok={voice.configured}
                status={voice.configured ? "Connected" : "Not set up"}
                href="/settings#voice-agent"
                cta="Configure"
              />
              <MonitorCard
                title="Monitor virtual calls"
                metric={String(voice.callsHandled)}
                metricLabel="calls handled, all time"
                href="/voice"
                cta="View calls"
              />
            </div>
          )}

          {tab === "sms" && (
            <div className="grid sm:grid-cols-2 gap-4">
              <SetupCard
                title="Set up text messaging"
                desc="Text back missed calls automatically and message your contacts from the AI assistant."
                ok={Boolean(sms.number) && sms.active}
                status={sms.number ? (sms.active ? "Auto-reply on" : "Auto-reply off") : "No number"}
                href="/settings#operations"
                cta="Configure"
              />
              <MonitorCard
                title="Monitor text-back"
                metric={sms.active ? "On" : "Off"}
                metricLabel={sms.number ?? "no number configured"}
                href="/voice"
                cta="View activity"
              />
            </div>
          )}

          {tab === "email" && (
            <div className="grid sm:grid-cols-2 gap-4">
              <SetupCard
                title="Set up an email campaign"
                desc="Send personalized campaigns to your client segments — leads, active clients, or prospects — via Resend."
                ok
                status="Ready"
                href="/marketing/new"
                cta="New campaign"
              />
              <MonitorCard
                title="Monitor campaigns"
                metric={String(email.sent)}
                metricLabel={`campaigns sent · ${email.reached} reached`}
                href="#email-campaigns"
                cta="View campaigns"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function SetupCard({
  title,
  desc,
  ok,
  status,
  href,
  cta,
}: {
  title: string;
  desc: string;
  ok: boolean;
  status: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
            ok ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {ok && <CheckCircle2 className="w-3 h-3" />}
          {status}
        </span>
      </div>
      <p className="text-xs text-slate-500 mb-4 leading-relaxed">{desc}</p>
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700"
      >
        <Settings className="w-3.5 h-3.5" />
        {cta}
      </Link>
    </div>
  );
}

function MonitorCard({
  title,
  metric,
  metricLabel,
  href,
  cta,
}: {
  title: string;
  metric: string;
  metricLabel: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-5 flex flex-col">
      <h3 className="text-sm font-semibold text-slate-800 mb-2">{title}</h3>
      <p className="text-2xl font-semibold text-slate-800 font-mono">{metric}</p>
      <p className="text-xs text-slate-400 mt-0.5 mb-4 truncate">{metricLabel}</p>
      <Link
        href={href}
        className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700"
      >
        {cta}
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
