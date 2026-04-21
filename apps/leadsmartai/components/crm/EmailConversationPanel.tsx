"use client";

import { useEffect, useState } from "react";
import { shouldOfferTranslationToEnglish } from "@/lib/locales/detectScript";
import { TranslationToggle } from "./TranslationToggle";

type Row = {
  id?: string;
  subject?: string;
  message?: string;
  direction?: string;
  created_at?: string;
};

export function EmailConversationPanel({ leadId }: { leadId: string }) {
  const [messages, setMessages] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/leads/${leadId}/email-thread`, { cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          messages?: Row[];
        };
        if (!cancelled && json?.success) {
          setMessages(Array.isArray(json.messages) ? json.messages : []);
        }
      } catch {
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">Email thread</h2>
        <p className="text-xs text-slate-500 mt-0.5">Logged inbound / outbound (Resend when configured)</p>
      </div>
      <div className="space-y-4 p-5">
        {loading ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-slate-500">No email messages logged yet.</div>
        ) : (
          messages.map((m) => {
            const text = m.message ?? "";
            const subject = m.subject ?? "";
            const isOutbound = String(m.direction ?? "").toLowerCase() === "outbound";
            // Inbound-only translation toggle; see SmsConversationPanel for
            // rationale.
            const bodyOffer = !isOutbound && shouldOfferTranslationToEnglish(text);
            const subjectOffer = !isOutbound && shouldOfferTranslationToEnglish(subject);
            return (
              <div
                key={m.id ?? `${m.direction}-${m.created_at}`}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
              >
                <div className="text-xs text-slate-500">
                  {String(m.direction ?? "").toUpperCase()} • {subject || "(no subject)"}
                </div>
                {subjectOffer ? (
                  <div className="mt-0.5">
                    <TranslationToggle text={subject} targetLocale="en" targetLabel="English" />
                  </div>
                ) : null}
                <div className="mt-2 whitespace-pre-wrap text-sm text-slate-900">{text}</div>
                {bodyOffer ? (
                  <TranslationToggle text={text} targetLocale="en" targetLabel="English" />
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
