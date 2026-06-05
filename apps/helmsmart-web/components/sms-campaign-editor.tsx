"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Send, Clock, Users, AlertCircle, CheckCircle2, Smartphone,
} from "lucide-react";
import { createSMSCampaign, updateSMSCampaign, sendSMSCampaignNow, deleteSMSCampaign } from "@/lib/actions/sms-campaigns";

const SEGMENTS = [
  { value: "all", label: "All contacts", description: "Everyone with a phone number" },
  { value: "leads", label: "Leads", description: "Contacts in lead stage" },
  { value: "prospects", label: "Prospects", description: "Contacts in prospect stage" },
  { value: "active", label: "Active clients", description: "Active status contacts" },
  { value: "won", label: "Won clients", description: "Closed/won pipeline contacts" },
] as const;

const TEMPLATES = [
  {
    label: "Appointment reminder",
    text: "Hi {name}, this is a reminder about your appointment tomorrow. Reply STOP to opt out.",
  },
  {
    label: "Special offer",
    text: "Hi {name}, we have a special offer just for you this week! Call or text us to learn more. Reply STOP to opt out.",
  },
  {
    label: "Check-in",
    text: "Hi {name}, just checking in — how is everything going? Let us know if there's anything we can help with. Reply STOP to opt out.",
  },
  {
    label: "Review request",
    text: "Hi {name}, thank you for being a valued client! We'd love if you left us a quick review. Reply STOP to opt out.",
  },
];

interface Props {
  campaignId?: string;
  initialValues?: {
    name: string;
    description: string;
    messageText: string;
    targetSegment: string;
    scheduledFor: string;
  };
  status?: string;
}

export function SMSCampaignEditor({ campaignId, initialValues, status }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [messageText, setMessageText] = useState(initialValues?.messageText ?? "");
  const [targetSegment, setTargetSegment] = useState<string>(
    initialValues?.targetSegment ?? "all"
  );
  const [scheduledFor, setScheduledFor] = useState(initialValues?.scheduledFor ?? "");
  const [scheduleEnabled, setScheduleEnabled] = useState(!!initialValues?.scheduledFor);
  const [error, setError] = useState<string | null>(null);
  const [sendConfirm, setSendConfirm] = useState(false);

  const charCount = messageText.length;
  const smsCount = Math.ceil(charCount / 160) || 1;
  const isEditable = !status || status === "draft" || status === "scheduled";

  const handleSaveDraft = () => {
    if (!name.trim() || !messageText.trim()) {
      setError("Name and message are required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      if (campaignId) {
        const result = await updateSMSCampaign(campaignId, {
          name: name.trim(),
          description: description.trim() || undefined,
          messageText: messageText.trim(),
          targetSegment: targetSegment as "all" | "leads" | "prospects" | "active" | "won" | "custom",
          scheduledFor: scheduleEnabled && scheduledFor ? scheduledFor : undefined,
        });
        if (!result.ok) {
          setError(result.error ?? "Failed to save");
        } else {
          router.refresh();
        }
      } else {
        const result = await createSMSCampaign({
          name: name.trim(),
          description: description.trim() || undefined,
          messageText: messageText.trim(),
          targetSegment: targetSegment as "all" | "leads" | "prospects" | "active" | "won" | "custom",
          scheduledFor: scheduleEnabled && scheduledFor ? scheduledFor : undefined,
        });
        if (!result.ok) {
          setError(result.error ?? "Failed to save");
        } else {
          router.push(`/marketing/sms/${result.campaignId}`);
        }
      }
    });
  };

  const handleSendNow = () => {
    if (!sendConfirm) {
      setSendConfirm(true);
      return;
    }
    setSendConfirm(false);
    if (!campaignId) {
      // Save first, then send
      startTransition(async () => {
        const result = await createSMSCampaign({
          name: name.trim(),
          description: description.trim() || undefined,
          messageText: messageText.trim(),
          targetSegment: targetSegment as "all" | "leads" | "prospects" | "active" | "won" | "custom",
        });
        if (!result.ok) {
          setError(result.error ?? "Failed to save");
          return;
        }
        const sendResult = await sendSMSCampaignNow(result.campaignId!);
        if (!sendResult.ok) {
          setError(sendResult.error ?? "Failed to send");
        } else {
          router.push("/marketing/sms");
        }
      });
    } else {
      startTransition(async () => {
        const result = await sendSMSCampaignNow(campaignId);
        if (!result.ok) {
          setError(result.error ?? "Failed to send");
        } else {
          router.push("/marketing/sms");
        }
      });
    }
  };

  const handleDelete = () => {
    if (!campaignId) return;
    startTransition(async () => {
      await deleteSMSCampaign(campaignId);
      router.push("/marketing/sms");
    });
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/marketing/sms"
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-slate-900">
            {campaignId ? "Edit Campaign" : "New SMS Campaign"}
          </h1>
          {status && (
            <p className="text-xs text-slate-500 mt-0.5 capitalize">Status: {status}</p>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Campaign name */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <label className="block text-sm font-semibold text-slate-800 mb-4">
            Campaign Details
          </label>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Campaign Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isEditable || isPending}
                placeholder="e.g. June promo, Winter check-in"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Description (optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!isEditable || isPending}
                placeholder="Internal notes about this campaign"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:bg-slate-50"
              />
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <label className="text-sm font-semibold text-slate-800">
              Message <span className="text-rose-500">*</span>
            </label>
            <span className={`text-xs font-medium ${charCount > 800 ? "text-rose-500" : "text-slate-400"}`}>
              {charCount}/1000 · {smsCount} SMS {smsCount > 1 ? "parts" : "part"}
            </span>
          </div>

          {/* Templates */}
          {isEditable && (
            <div className="mb-3">
              <p className="text-xs font-medium text-slate-500 mb-2">Quick templates:</p>
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => setMessageText(t.text)}
                    disabled={isPending}
                    className="text-xs px-2.5 py-1 border border-slate-200 rounded-full text-slate-600 hover:bg-slate-50 hover:border-indigo-200 transition-colors disabled:opacity-50"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            disabled={!isEditable || isPending}
            placeholder="Type your message here... Include STOP to opt out language."
            rows={5}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none disabled:opacity-60 disabled:bg-slate-50"
          />

          {/* Preview */}
          {messageText && (
            <div className="mt-4 bg-slate-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3 text-xs text-slate-500 font-medium">
                <Smartphone className="w-3.5 h-3.5" />
                Preview
              </div>
              <div className="max-w-xs">
                <div className="bg-emerald-500 text-white text-sm rounded-2xl rounded-br-sm px-4 py-2.5 leading-relaxed inline-block">
                  {messageText}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Target audience */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-slate-500" />
            <label className="text-sm font-semibold text-slate-800">Target Audience</label>
          </div>
          <div className="space-y-2">
            {SEGMENTS.map((seg) => (
              <label
                key={seg.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  targetSegment === seg.value
                    ? "bg-indigo-50 border-indigo-200"
                    : "border-slate-100 hover:bg-slate-50"
                } ${!isEditable ? "pointer-events-none opacity-60" : ""}`}
              >
                <input
                  type="radio"
                  name="segment"
                  value={seg.value}
                  checked={targetSegment === seg.value}
                  onChange={() => setTargetSegment(seg.value)}
                  disabled={!isEditable || isPending}
                  className="mt-0.5 text-indigo-600"
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">{seg.label}</p>
                  <p className="text-xs text-slate-500">{seg.description}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-xs text-amber-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Opt-outs are always respected. Contacts who have unsubscribed from SMS will be
              excluded automatically.
            </span>
          </div>
        </div>

        {/* Schedule */}
        {isEditable && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <label className="text-sm font-semibold text-slate-800">Schedule</label>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-slate-500">Schedule for later</span>
                <div
                  onClick={() => setScheduleEnabled((v) => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                    scheduleEnabled ? "bg-indigo-600" : "bg-slate-200"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      scheduleEnabled ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </div>
              </label>
            </div>

            {scheduleEnabled ? (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Send at (local time)
                </label>
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  disabled={isPending}
                  min={new Date().toISOString().slice(0, 16)}
                  className="text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>
            ) : (
              <p className="text-xs text-slate-400">Click "Send Now" to dispatch immediately.</p>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Send confirm */}
        {sendConfirm && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-900 mb-1">
              Confirm — send this campaign now?
            </p>
            <p className="text-xs text-amber-700 mb-4">
              This will send SMS messages to all matched recipients immediately. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleSendNow}
                disabled={isPending}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                Yes, send now
              </button>
              <button
                onClick={() => setSendConfirm(false)}
                className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        {isEditable && !sendConfirm && (
          <div className="flex items-center gap-3">
            {!scheduleEnabled ? (
              <button
                onClick={handleSendNow}
                disabled={isPending || !name.trim() || !messageText.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {isPending ? "Sending…" : "Send Now"}
              </button>
            ) : (
              <button
                onClick={handleSaveDraft}
                disabled={isPending || !name.trim() || !messageText.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                <Clock className="w-3.5 h-3.5" />
                {isPending ? "Scheduling…" : "Schedule Campaign"}
              </button>
            )}
            <button
              onClick={handleSaveDraft}
              disabled={isPending || !name.trim() || !messageText.trim()}
              className="px-5 py-2.5 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save Draft"}
            </button>
            {campaignId && (
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="ml-auto text-xs text-rose-600 hover:text-rose-700 font-medium disabled:opacity-50"
              >
                Delete campaign
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
