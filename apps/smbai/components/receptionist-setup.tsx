"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, Copy, Check, PhoneCall } from "lucide-react";

export type SetupStatus = {
  numberOk: boolean;
  number: string | null;
  hoursOk: boolean;
  typesOk: boolean;
  typesCount: number;
  agentEnabled: boolean;
  googleConfigured: boolean;
  googleConnected: boolean;
  inboundUrl: string;
  functionUrl: string;
};

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="flex items-stretch gap-1.5">
        <code className="flex-1 text-xs bg-white border border-slate-200 rounded px-2.5 py-1.5 text-indigo-700 font-mono break-all">
          {value}
        </code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex items-center gap-1 px-2 rounded border border-slate-200 bg-white text-xs text-slate-500 hover:text-slate-700 hover:border-slate-300"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

function Item({ ok, label, fix }: { ok: boolean; label: string; fix: string }) {
  return (
    <li className="flex items-start gap-2.5 py-2">
      {ok ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
      )}
      <div className="min-w-0">
        <p className={`text-sm ${ok ? "text-slate-700" : "text-slate-800 font-medium"}`}>{label}</p>
        {!ok && <p className="text-xs text-slate-500 mt-0.5">{fix}</p>}
      </div>
    </li>
  );
}

export function ReceptionistSetup({ status }: { status: SetupStatus }) {
  const appReady = status.numberOk && status.hoursOk && status.typesOk && status.agentEnabled;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8">
      <div className="flex items-center gap-2 mb-1">
        <PhoneCall className="w-4 h-4 text-indigo-500" />
        <h3 className="text-sm font-semibold text-slate-800">Receptionist setup</h3>
        {appReady ? (
          <span className="ml-auto text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Ready</span>
        ) : (
          <span className="ml-auto text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Needs setup</span>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-4">Everything below must be set for the agent to answer and book.</p>

      {/* What the app controls */}
      <ul className="divide-y divide-slate-100 mb-5">
        <Item
          ok={status.numberOk}
          label={status.numberOk ? `Phone number connected — ${status.number}` : "Phone number not set"}
          fix="Add your number under Reception → Auto-reply settings (saved as +1XXXXXXXXXX)."
        />
        <Item
          ok={status.hoursOk}
          label="Business hours set"
          fix="Set open days/times in the “Business hours” section below."
        />
        <Item
          ok={status.typesOk}
          label={status.typesOk ? `Appointment types added (${status.typesCount})` : "No appointment types"}
          fix="Add at least one service (with a duration) in “Appointment types” below."
        />
        <Item
          ok={status.agentEnabled}
          label="Voice agent enabled"
          fix="Turn on the “AI Voice Agent” toggle above."
        />
        <Item
          ok={status.googleConnected}
          label={status.googleConnected ? "Google Calendar connected" : "Google Calendar (optional)"}
          fix={status.googleConfigured ? "Connect Google Calendar below to only offer times you’re actually free." : "Optional — connect a calendar to avoid double-booking."}
        />
      </ul>

      {/* What you wire in Retell */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Connect the number in Retell</h4>
        <ol className="text-xs text-slate-600 space-y-1.5 mb-3 list-decimal list-inside">
          <li>Open your number in Retell → <strong>Inbound Call Agent</strong>.</li>
          <li>Set the call agent to your shared receptionist agent.</li>
          <li>Check <strong>“Add an inbound webhook”</strong> and paste the URL below (replace the key with your <code className="font-mono">RETELL_FUNCTION_SECRET</code>).</li>
          <li>Point each custom function (check_availability, book_appointment, create_callback) at the function URL.</li>
        </ol>
        <div className="space-y-2.5">
          <CopyField label="Inbound webhook (on the phone number)" value={status.inboundUrl} />
          <CopyField label="Custom functions endpoint" value={status.functionUrl} />
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Use the <strong>www</strong> URLs exactly as shown — the bare domain redirects and Retell won’t follow it on a POST.
        </p>
      </div>
    </div>
  );
}
