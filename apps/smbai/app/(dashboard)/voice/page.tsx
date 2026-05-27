import { Metadata } from "next";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { VoiceSettings } from "@/components/voice-settings";
import { Phone, MessageSquare, Calendar, Bot } from "lucide-react";

export const metadata: Metadata = { title: "Voice Agent" };

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
  const orgId = cookieStore.get("smbai-org-id")?.value ?? "";
  const supabase = await createClient();

  const [{ data: org }, { data: sessions }] = await Promise.all([
    supabase
      .from("organizations")
      .select("twilio_number, voice_agent_enabled, voice_agent_greeting, voice_agent_prompt")
      .eq("id", orgId)
      .single(),
    supabase
      .from("voice_sessions")
      .select("id, from_number, messages, status, booked_event_id, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const totalSessions = sessions?.length ?? 0;
  const booked  = (sessions ?? []).filter((s) => s.booked_event_id).length;
  const msgLeft = (sessions ?? []).filter(
    (s) => (s.messages as { role: string }[]).some((m) => m.role === "user") && !s.booked_event_id
  ).length;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Voice Agent</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Claude answers your calls 24/7 — books appointments, takes messages, handles FAQs
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
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

      {/* Webhook info */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-8">
        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">Twilio webhook</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Voice webhook URL:</span>
          <code className="text-xs bg-white border border-slate-200 rounded px-2.5 py-1 text-indigo-700 font-mono">
            {process.env.NEXT_PUBLIC_APP_URL}/api/twilio/voice
          </code>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Set this as the "A call comes in" webhook on your Twilio number. For local testing, use ngrok.
        </p>
      </div>

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
                      <p className="text-xs text-slate-400">{turns} turn{turns !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {session.booked_event_id && (
                        <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">Appointment booked</span>
                      )}
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
