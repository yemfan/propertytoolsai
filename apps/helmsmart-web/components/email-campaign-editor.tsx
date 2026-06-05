"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Clock, Users, AlertCircle, CheckCircle2, Smartphone, Eye } from "lucide-react";
import { createEmailCampaign, updateEmailCampaign, sendEmailCampaignNow, deleteEmailCampaign } from "@/lib/actions/email-campaigns";

const SEGMENTS = [
  { value: "all",       label: "All clients",    description: "Everyone with an email address" },
  { value: "leads",     label: "Leads",          description: "Contacts in lead stage" },
  { value: "prospects", label: "Prospects",      description: "Contacts in prospect stage" },
  { value: "active",    label: "Active clients", description: "Active status contacts" },
  { value: "won",       label: "Won clients",    description: "Closed/won pipeline contacts" },
] as const;

const TEMPLATES = [
  {
    label: "Monthly newsletter",
    subject: "What's new at {{org_name}} — {{month}}",
    body: `<p>Hi {{name}},</p>

<p>Here's what we've been up to this month at {{org_name}}...</p>

<h2>Updates</h2>
<p>Add your updates here.</p>

<h2>What's coming</h2>
<p>Share upcoming offers, services, or events.</p>

<p>As always, thank you for being a valued client.</p>

<p>Best,<br>The {{org_name}} team</p>

<p style="font-size:12px;color:#888;">
  You're receiving this because you're a client of {{org_name}}.
  <a href="#">Unsubscribe</a>
</p>`,
  },
  {
    label: "Special offer",
    subject: "A special offer just for you, {{name}}",
    body: `<p>Hi {{name}},</p>

<p>We have a limited-time offer we wanted to share with you exclusively.</p>

<p style="font-size:18px;font-weight:bold;color:#4f46e5;">
  [Your offer here]
</p>

<p>This offer expires on [date]. Reply to this email or call us to take advantage.</p>

<p>Thank you for your continued trust,<br>{{org_name}}</p>

<p style="font-size:12px;color:#888;">
  <a href="#">Unsubscribe</a>
</p>`,
  },
  {
    label: "Check-in email",
    subject: "Checking in — {{name}}",
    body: `<p>Hi {{name}},</p>

<p>I wanted to reach out and see how everything is going on your end.</p>

<p>If there's anything we can help with, or if you have questions about our services, please don't hesitate to reach out.</p>

<p>We'd love to hear from you!</p>

<p>Warm regards,<br>{{org_name}}</p>

<p style="font-size:12px;color:#888;">
  <a href="#">Unsubscribe</a>
</p>`,
  },
];

interface Props {
  campaignId?: string;
  initialValues?: {
    name: string;
    subject: string;
    previewText: string;
    bodyHtml: string;
    fromName: string;
    replyTo: string;
    targetSegment: string;
    scheduledFor: string;
  };
  status?: string;
}

export function EmailCampaignEditor({ campaignId, initialValues, status }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName]               = useState(initialValues?.name ?? "");
  const [subject, setSubject]         = useState(initialValues?.subject ?? "");
  const [previewText, setPreviewText] = useState(initialValues?.previewText ?? "");
  const [bodyHtml, setBodyHtml]       = useState(initialValues?.bodyHtml ?? TEMPLATES[0].body);
  const [fromName, setFromName]       = useState(initialValues?.fromName ?? "");
  const [replyTo, setReplyTo]         = useState(initialValues?.replyTo ?? "");
  const [targetSegment, setTargetSegment] = useState(initialValues?.targetSegment ?? "all");
  const [scheduledFor, setScheduledFor]   = useState(initialValues?.scheduledFor ?? "");
  const [scheduleEnabled, setScheduleEnabled] = useState(!!initialValues?.scheduledFor);

  const [activeTab, setActiveTab]   = useState<"content" | "audience" | "settings">("content");
  const [showPreview, setShowPreview] = useState(false);
  const [sendConfirm, setSendConfirm] = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const isEditable = !status || status === "draft" || status === "scheduled";

  const handleSaveDraft = () => {
    if (!name.trim() || !subject.trim() || !bodyHtml.trim()) {
      setError("Name, subject, and body are required.");
      return;
    }
    setError(null);
    setSaved(false);

    startTransition(async () => {
      if (campaignId) {
        const result = await updateEmailCampaign(campaignId, {
          name: name.trim(),
          subject: subject.trim(),
          previewText: previewText.trim(),
          bodyHtml,
          fromName: fromName.trim(),
          replyTo: replyTo.trim(),
          targetSegment: targetSegment as "all" | "leads" | "prospects" | "active" | "won",
          scheduledFor: scheduleEnabled && scheduledFor ? scheduledFor : "",
        });
        if (!result.ok) { setError(result.error ?? "Failed to save"); return; }
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        const result = await createEmailCampaign({
          name: name.trim(),
          subject: subject.trim(),
          previewText: previewText.trim(),
          bodyHtml,
          fromName: fromName.trim(),
          replyTo: replyTo.trim(),
          targetSegment: targetSegment as "all" | "leads" | "prospects" | "active" | "won",
          scheduledFor: scheduleEnabled && scheduledFor ? scheduledFor : undefined,
        });
        if (!result.ok) { setError(result.error ?? "Failed to create"); return; }
        router.push(`/marketing/email/${result.campaignId}`);
      }
    });
  };

  const handleSend = () => {
    if (!sendConfirm) { setSendConfirm(true); return; }
    setSendConfirm(false);
    startTransition(async () => {
      // Save first if new
      if (!campaignId) {
        const createResult = await createEmailCampaign({
          name: name.trim(), subject: subject.trim(), previewText: previewText.trim(),
          bodyHtml, fromName: fromName.trim(), replyTo: replyTo.trim(),
          targetSegment: targetSegment as "all" | "leads" | "prospects" | "active" | "won",
        });
        if (!createResult.ok) { setError(createResult.error ?? "Failed to create"); return; }
        const sendResult = await sendEmailCampaignNow(createResult.campaignId!);
        if (!sendResult.ok) { setError(sendResult.error ?? "Failed to send"); return; }
        router.push("/marketing/email");
      } else {
        const sendResult = await sendEmailCampaignNow(campaignId);
        if (!sendResult.ok) { setError(sendResult.error ?? "Failed to send"); return; }
        router.push("/marketing/email");
      }
    });
  };

  const handleDelete = () => {
    if (!campaignId || !confirm("Delete this campaign?")) return;
    startTransition(async () => {
      await deleteEmailCampaign(campaignId);
      router.push("/marketing/email");
    });
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/marketing/email" className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-semibold text-slate-900 flex-1">
          {campaignId ? "Edit Campaign" : "New Email Campaign"}
        </h1>
        <div className="flex gap-2">
          <button onClick={() => setShowPreview((v) => !v)} className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            <Eye className="w-3.5 h-3.5" />
            {showPreview ? "Edit" : "Preview"}
          </button>
          {isEditable && (
            <button
              onClick={handleSaveDraft}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {saved ? "Saved ✓" : "Save Draft"}
            </button>
          )}
        </div>
      </div>

      {showPreview ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-1">Subject: {subject || "No subject"}</p>
            {previewText && <p className="text-xs text-slate-400">{previewText}</p>}
          </div>
          <div
            className="p-8 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: bodyHtml
              .replace(/\{\{name\}\}/gi, "John")
              .replace(/\{\{org_name\}\}/gi, "Your Business")
              .replace(/\{\{month\}\}/gi, new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }))
            }}
          />
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-lg w-fit">
            {(["content", "audience", "settings"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                  activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Campaign name always visible */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Campaign Name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={!isEditable || isPending}
                  placeholder="e.g. June Newsletter" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Email Subject *</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!isEditable || isPending}
                  placeholder="What's new at {{org_name}}" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60" />
              </div>
            </div>
          </div>

          {activeTab === "content" && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Preview text (shown in inbox)</label>
                <input type="text" value={previewText} onChange={(e) => setPreviewText(e.target.value)} disabled={!isEditable || isPending}
                  placeholder="A short teaser shown in the email client preview" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60" />
              </div>

              {/* Template buttons */}
              {isEditable && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Load template:</p>
                  <div className="flex gap-2 flex-wrap">
                    {TEMPLATES.map((t) => (
                      <button key={t.label} type="button" onClick={() => { setBodyHtml(t.body); setSubject(t.subject); }}
                        disabled={isPending}
                        className="text-xs px-2.5 py-1 border border-slate-200 rounded-full text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-600">Body (HTML) *</label>
                  <span className="text-xs text-slate-400">Merge tags: {"{{name}}"}, {"{{org_name}}"}, {"{{email}}"}</span>
                </div>
                <textarea
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  disabled={!isEditable || isPending}
                  rows={20}
                  className="w-full text-sm font-mono border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y disabled:opacity-60"
                />
              </div>
            </div>
          )}

          {activeTab === "audience" && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-800">Target Audience</h2>
              </div>
              <div className="space-y-2">
                {SEGMENTS.map((seg) => (
                  <label key={seg.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    targetSegment === seg.value ? "bg-indigo-50 border-indigo-200" : "border-slate-100 hover:bg-slate-50"
                  } ${!isEditable ? "pointer-events-none opacity-60" : ""}`}>
                    <input type="radio" name="segment" value={seg.value} checked={targetSegment === seg.value}
                      onChange={() => setTargetSegment(seg.value)} disabled={!isEditable || isPending} className="mt-0.5 text-indigo-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{seg.label}</p>
                      <p className="text-xs text-slate-500">{seg.description}</p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                Email unsubscribes are always respected. Opted-out contacts are excluded automatically.
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                <h2 className="text-sm font-semibold text-slate-800">Sender</h2>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">From name</label>
                  <input type="text" value={fromName} onChange={(e) => setFromName(e.target.value)} disabled={!isEditable || isPending}
                    placeholder="Jane at Your Business" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Reply-to email</label>
                  <input type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} disabled={!isEditable || isPending}
                    placeholder="jane@yourbusiness.com" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60" />
                </div>
              </div>

              {isEditable && (
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <h2 className="text-sm font-semibold text-slate-800">Schedule</h2>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-xs text-slate-500">Schedule for later</span>
                      <div onClick={() => setScheduleEnabled((v) => !v)}
                        className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${scheduleEnabled ? "bg-indigo-600" : "bg-slate-200"}`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${scheduleEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                      </div>
                    </label>
                  </div>
                  {scheduleEnabled ? (
                    <input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)} disabled={isPending}
                      className="text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  ) : (
                    <p className="text-xs text-slate-400">Click "Send Now" to dispatch immediately.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Send confirm */}
          {sendConfirm && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-900 mb-1">Send this campaign now?</p>
              <p className="text-xs text-amber-700 mb-4">This will email all matched recipients immediately. This cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={handleSend} disabled={isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                  <Send className="w-3.5 h-3.5" />
                  Yes, send now
                </button>
                <button onClick={() => setSendConfirm(false)} className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          {isEditable && !sendConfirm && (
            <div className="mt-5 flex items-center gap-3">
              {!scheduleEnabled ? (
                <button onClick={handleSend} disabled={isPending || !name.trim() || !subject.trim() || !bodyHtml.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                  <Send className="w-3.5 h-3.5" />
                  {isPending ? "Sending…" : "Send Now"}
                </button>
              ) : (
                <button onClick={handleSaveDraft} disabled={isPending || !name.trim() || !subject.trim() || !bodyHtml.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                  <Clock className="w-3.5 h-3.5" />
                  {isPending ? "Scheduling…" : "Schedule Campaign"}
                </button>
              )}
              {campaignId && (
                <button onClick={handleDelete} disabled={isPending}
                  className="ml-auto text-xs text-rose-600 hover:text-rose-700 font-medium disabled:opacity-50">
                  Delete campaign
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
