import { ResponsibleEmployee } from "@/components/responsible-employee";
import { PageTitle } from "@/components/page-title";
import { Metadata } from "next";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { Phone, PhoneMissed, MessageSquare, CheckCircle2, Settings } from "lucide-react";

export const metadata: Metadata = { title: "Reception" };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function ReceptionPage() {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value ?? "";
  const supabase = await createClient();

  // Load org settings
  const { data: org } = await supabase
    .from("organizations")
    .select("id, twilio_number, auto_reply, auto_reply_msg")
    .eq("id", orgId)
    .single();

  // Load recent calls
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: calls } = await supabase
    .from("calls")
    .select(`
      id, from_number, to_number, status, auto_replied, reply_body, called_at, duration_seconds,
      clients(first_name, last_name)
    `)
    .eq("organization_id", orgId)
    .order("called_at", { ascending: false })
    .limit(50);

  const missedToday = (calls ?? []).filter(
    (c) => c.status === "missed" && new Date(c.called_at) >= today
  ).length;

  const repliesThisWeek = (() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return (calls ?? []).filter((c) => c.auto_replied && new Date(c.called_at) >= weekAgo).length;
  })();

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8 gap-4">
        <div>
          <ResponsibleEmployee slug="emma" className="mb-3" />
          <PageTitle base="Reception" />
          <p className="text-sm text-slate-500 mt-0.5">
            Missed call text-back — never lose a lead to voicemail
          </p>
        </div>
        <a
          href="/settings#operations"
          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors shrink-0"
        >
          <Settings className="w-4 h-4" />
          Auto-reply settings
        </a>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Auto-reply</span>
            <div className={`w-2 h-2 rounded-full ${org?.auto_reply ? "bg-emerald-500" : "bg-slate-300"}`} />
          </div>
          <p className="text-sm font-medium text-slate-700">{org?.auto_reply ? "Active" : "Off"}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {org?.twilio_number ? org.twilio_number : "No number configured"}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Missed Today</span>
            <PhoneMissed className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-semibold text-slate-800 font-mono">{missedToday}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {missedToday === 0 ? "None today" : `${missedToday} unanswered call${missedToday !== 1 ? "s" : ""}`}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Replies Sent</span>
            <MessageSquare className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-semibold text-slate-800 font-mono">{repliesThisWeek}</p>
          <p className="text-xs text-slate-400 mt-0.5">This week</p>
        </div>
      </div>

      {/* Call log */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Recent Calls</h2>
        </div>

        {!calls?.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <PhoneMissed className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-xs font-medium text-slate-500 mb-1">No calls recorded yet</p>
            <p className="text-xs text-slate-400">
              Missed calls will appear here once your Twilio number is configured.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {calls.map((call) => {
              const clientsRaw = call.clients;
              const clientRaw = (Array.isArray(clientsRaw) ? clientsRaw[0] : clientsRaw) as { first_name: string | null; last_name: string | null } | null;
              const clientName = clientRaw
                ? [clientRaw.first_name, clientRaw.last_name].filter(Boolean).join(" ")
                : null;

              return (
                <div key={call.id} className="flex items-center gap-4 px-6 py-3">
                  {/* Status icon */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    call.status === "missed" ? "bg-rose-100" : "bg-emerald-100"
                  }`}>
                    {call.status === "missed"
                      ? <PhoneMissed className="w-4 h-4 text-rose-500" />
                      : <Phone className="w-4 h-4 text-emerald-500" />
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {clientName ?? call.from_number}
                    </p>
                    {clientName && (
                      <p className="text-xs text-slate-400">{call.from_number}</p>
                    )}
                  </div>

                  {/* Auto-replied badge */}
                  {call.auto_replied && (
                    <div className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      Auto-replied
                    </div>
                  )}

                  {/* Status + time */}
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xs font-medium ${
                      call.status === "missed" ? "text-rose-600" : "text-emerald-600"
                    }`}>
                      {call.status ? call.status.charAt(0).toUpperCase() + call.status.slice(1) : "—"}
                    </p>
                    <p className="text-xs text-slate-400">{timeAgo(call.called_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
