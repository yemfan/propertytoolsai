import { Metadata } from "next";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { VoiceSettings } from "@/components/voice-settings";
import { ReceptionistConfig } from "@/components/receptionist-config";
import { ReceptionistSetup } from "@/components/receptionist-setup";
import { defaultBusinessHours, type BusinessHours, type AppointmentType, type KnowledgeEntry } from "@/lib/receptionist";
import { isGoogleCalendarConfigured, isGoogleCalendarConnected, getConnectedGoogleAccount } from "@/lib/google-calendar";
import { Phone, MessageSquare, Calendar, Bot, Clock, DollarSign, Mic } from "lucide-react";

export const metadata: Metadata = { title: "Voice Agent" };

const RETELL_COST_PER_MINUTE = 0.10; // USD — placeholder; billing to customers at $0.10/min (Retell cost ~$0.07)

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function VoicePage() {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value ?? "";
  const supabase = await createClient();

  const [{ data: org }, { data: sessions }, { data: apptTypes }, { data: knowledge }] = await Promise.all([
    supabase
      .from("organizations")
      .select("twilio_number, voice_agent_enabled, voice_agent_greeting, voice_agent_prompt, business_hours")
      .eq("id", orgId)
      .single(),
    supabase
      .from("voice_sessions")
      .select("id, from_number, messages, status, booked_event_id, summary, duration_seconds, recording_url, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("appointment_types")
      .select("id, name, duration_minutes, description, active, sort")
      .eq("organization_id", orgId)
      .order("sort"),
    supabase
      .from("knowledge_base")
      .select("id, title, content, active, sort")
      .eq("organization_id", orgId)
      .order("sort"),
  ]);

  const googleConfigured = isGoogleCalendarConfigured();
  const [googleConnected, googleEmail] = googleConfigured
    ? await Promise.all([isGoogleCalendarConnected(orgId), getConnectedGoogleAccount(orgId)])
    : [false, null];

  const totalSessions = sessions?.length ?? 0;
  const booked  = (sessions ?? []).filter((s) => s.booked_event_id).length;
  const msgLeft = (sessions ?? []).filter(
    (s) => (s.messages as { role: string }[]).some((m) => m.role === "user") && !s.booked_event_id
  ).length;
  const totalSeconds = (sessions ?? []).reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
  const totalMinutes = totalSeconds / 60;
  const estCost = totalMinutes * RETELL_COST_PER_MINUTE;

  // Guided setup status. Canonicalize the host to www so we never hand out the
  // bare domain (which 302-redirects and breaks Retell's POST webhooks).
  const canonicalBase = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.helmsmart.ai").replace(
    /:\/\/helmsmart\.ai/,
    "://www.helmsmart.ai"
  );
  const businessHours = (org?.business_hours as BusinessHours | null) ?? null;
  const setupStatus = {
    numberOk: Boolean(org?.twilio_number),
    number: (org?.twilio_number as string | null) ?? null,
    hoursOk: businessHours ? Object.values(businessHours).some(Boolean) : false,
    typesOk: (apptTypes?.length ?? 0) > 0,
    typesCount: apptTypes?.length ?? 0,
    agentEnabled: Boolean(org?.voice_agent_enabled),
    googleConfigured,
    googleConnected,
    inboundUrl: `${canonicalBase}/api/retell/inbound?k=<RETELL_FUNCTION_SECRET>`,
    functionUrl: `${canonicalBase}/api/retell/function`,
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Voice Agent</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Claude answers your calls 24/7 — books appointments, takes messages, handles FAQs
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Calls Handled</span>
            <Phone className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-semibold text-slate-800 font-mono">{totalSessions}</p>
          <p className="text-xs text-slate-400 mt-0.5">All time</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Appointments Booked</span>
            <Calendar className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-semibold text-slate-800 font-mono">{booked}</p>
          <p className="text-xs text-slate-400 mt-0.5">Via voice agent</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Messages Taken</span>
            <MessageSquare className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-semibold text-slate-800 font-mono">{msgLeft}</p>
          <p className="text-xs text-slate-400 mt-0.5">Saved to Inbox</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Minutes Used</span>
            <Clock className="w-4 h-4 text-violet-400" />
          </div>
          <p className="text-2xl font-semibold text-slate-800 font-mono">
            {totalMinutes >= 60
              ? `${(totalMinutes / 60).toFixed(1)}h`
              : `${totalMinutes.toFixed(1)}m`}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Talk time</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Est. AI Cost</span>
            <DollarSign className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-semibold text-slate-800 font-mono">
            ${estCost.toFixed(2)}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">@ $0.10/min</p>
        </div>
      </div>

      {/* Settings */}
      <div className="mb-8">
        <VoiceSettings
          enabled={org?.voice_agent_enabled ?? false}
          greeting={org?.voice_agent_greeting ?? "Hello! Thank you for calling. How can I help you today?"}
          prompt={org?.voice_agent_prompt ?? ""}
          twilioNumber={org?.twilio_number ?? null}
        />
      </div>

      {/* Receptionist brain: hours, appointment types, knowledge */}
      <div className="mb-8">
        <ReceptionistConfig
          hours={(org?.business_hours as BusinessHours | null) ?? defaultBusinessHours()}
          appointmentTypes={(apptTypes ?? []) as AppointmentType[]}
          knowledge={(knowledge ?? []) as KnowledgeEntry[]}
          googleConfigured={googleConfigured}
          googleConnected={googleConnected}
          googleEmail={googleEmail}
        />
      </div>

      {/* Guided setup checklist + Retell wiring */}
      <ReceptionistSetup status={setupStatus} />

      {/* Call transcript log */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Bot className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-slate-700">Call transcripts</h2>
        </div>

        {!sessions?.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Phone className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-xs font-medium text-slate-500 mb-1">No calls yet</p>
            <p className="text-xs text-slate-400">
              Enable the voice agent and configure your Twilio webhook to start handling calls.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {sessions.map((session) => {
              const msgs = session.messages as { role: string; content: string }[];
              const turns = Math.ceil(msgs.length / 2);
              return (
                <details key={session.id} className="group">
                  <summary className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-slate-50 list-none">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${session.status === "completed" ? "bg-slate-300" : "bg-emerald-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{session.from_number}</p>
                      {session.summary ? (
                        <p className="text-xs text-slate-500 truncate">{session.summary}</p>
                      ) : (
                        <p className="text-xs text-slate-400">{turns} turn{turns !== 1 ? "s" : ""}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {session.booked_event_id && (
                        <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">Appointment booked</span>
                      )}
                      {session.duration_seconds ? (
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-mono">
                          {formatDuration(session.duration_seconds)}
                        </span>
                      ) : null}
                      {session.recording_url ? (
                        <a
                          href={session.recording_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700"
                        >
                          <Mic className="w-3 h-3" />
                          Recording
                        </a>
                      ) : null}
                      <span className="text-xs text-slate-400">{timeAgo(session.created_at)}</span>
                      <span className="text-slate-300 group-open:rotate-90 transition-transform">›</span>
                    </div>
                  </summary>
                  <div className="px-6 pb-4 space-y-2 bg-slate-50/50">
                    {msgs.map((msg, i) => (
                      <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-sm rounded-xl px-3 py-2 text-sm ${
                          msg.role === "user"
                            ? "bg-white border border-slate-200 text-slate-700"
                            : "bg-indigo-600 text-white"
                        }`}>
                          <p className="text-xs font-semibold mb-0.5 opacity-60">
                            {msg.role === "user" ? "Caller" : "AI Agent"}
                          </p>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
