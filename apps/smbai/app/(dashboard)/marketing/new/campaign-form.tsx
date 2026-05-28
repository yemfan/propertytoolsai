"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Eye, EyeOff, Sparkles } from "lucide-react";
import { createCampaign, sendCampaign, generateCampaignCopy, type CampaignTone } from "@/lib/actions/campaigns";

type RecipientFilter = "all" | "active" | "leads" | "prospects" | "inactive";

const SEGMENTS: { value: RecipientFilter; label: string; desc: string }[] = [
  { value: "all",       label: "All clients",  desc: "Everyone with an email" },
  { value: "active",    label: "Active",        desc: "Active clients only" },
  { value: "leads",     label: "Leads",         desc: "New leads" },
  { value: "prospects", label: "Prospects",     desc: "Qualified prospects" },
  { value: "inactive",  label: "Inactive",      desc: "Lapsed clients" },
];

export function CampaignForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [filter, setFilter] = useState<RecipientFilter>("active");
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<"draft" | "send" | null>(null);
  const [error, setError] = useState("");

  const [aiPrompt, setAiPrompt]   = useState("");
  const [aiTone, setAiTone]       = useState<CampaignTone>("promotional");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError]     = useState("");

  async function generateCopy() {
    if (!aiPrompt.trim()) return;
    setAiError("");
    setAiLoading(true);
    try {
      const { subject: s, body: b } = await generateCampaignCopy({ prompt: aiPrompt.trim(), tone: aiTone });
      if (s) setSubject(s);
      if (b) setBody(b);
      if (!name.trim() && s) setName(s);
      setPreview(false);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSubmit(sendNow: boolean) {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      setError("Name, subject, and body are required.");
      return;
    }
    setError("");
    setLoading(true);
    setAction(sendNow ? "send" : "draft");

    try {
      const id = await createCampaign({
        name: name.trim(),
        subject: subject.trim(),
        body: body.trim(),
        recipient_filter: filter,
      });

      if (sendNow) {
        await sendCampaign(id);
        router.push(`/marketing/${id}`);
      } else {
        router.push(`/marketing/${id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setAction(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* AI copywriter */}
      <div className="bg-gradient-to-br from-indigo-50 to-white rounded-xl border border-indigo-100 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-slate-800">Write with AI</h2>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            What&rsquo;s this campaign about?
          </label>
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            rows={2}
            placeholder="e.g. Spring promotion — 15% off airport transfers booked in May"
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={aiTone}
            onChange={(e) => setAiTone(e.target.value as CampaignTone)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="promotional">Promotional</option>
            <option value="friendly">Friendly</option>
            <option value="professional">Professional</option>
            <option value="announcement">Announcement</option>
          </select>
          <button
            type="button"
            onClick={generateCopy}
            disabled={aiLoading || !aiPrompt.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {aiLoading ? "Writing…" : "Generate"}
          </button>
          {aiError && <span className="text-xs text-rose-600">{aiError}</span>}
        </div>
        <p className="text-[11px] text-slate-400">
          AI drafts the subject and message below — review and edit before sending.
        </p>
      </div>

      {/* Campaign name */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-slate-800">Campaign details</h2>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Campaign name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Monthly newsletter – May 2026"
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Subject line
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="An engaging subject line…"
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-slate-400 mt-1">
            {subject.length} characters · Keep under 60 for best open rates
          </p>
        </div>
      </div>

      {/* Recipient segment */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Recipients</h2>
        <div className="grid grid-cols-5 gap-2">
          {SEGMENTS.map((seg) => (
            <button
              key={seg.value}
              type="button"
              onClick={() => setFilter(seg.value)}
              className={`flex flex-col items-center text-center p-3 rounded-xl border-2 transition-colors ${
                filter === seg.value
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/50"
              }`}
            >
              <span className="text-xs font-semibold">{seg.label}</span>
              <span className="text-[10px] text-slate-400 mt-0.5">{seg.desc}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Only clients with an email address will receive this campaign.
        </p>
      </div>

      {/* Body */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-800">Message</h2>
          <button
            type="button"
            onClick={() => setPreview((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            {preview ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            {preview ? "Edit" : "Preview"}
          </button>
        </div>

        {preview ? (
          <div className="min-h-48 bg-slate-50 rounded-lg p-4">
            <p className="text-sm font-medium text-slate-700 mb-3">
              Subject: {subject || "(no subject)"}
            </p>
            <div className="border-t border-slate-200 pt-3 space-y-2">
              {body.split("\n").map((line, i) =>
                line.trim() ? (
                  <p key={i} className="text-sm text-slate-700 leading-relaxed">
                    {line}
                  </p>
                ) : (
                  <div key={i} className="h-2" />
                )
              )}
            </div>
          </div>
        ) : (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            placeholder={`Hi [client name],\n\nWrite your message here...\n\nBest,\n[Your name]`}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono"
          />
        )}
        <p className="text-xs text-slate-400 mt-2">
          Plain text · Client names are automatically personalized in the greeting
        </p>
      </div>

      {error && (
        <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={loading}
          className="flex-1 py-3 text-sm font-medium border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-60 transition-colors"
        >
          {loading && action === "draft" ? "Saving…" : "Save as draft"}
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {loading && action === "send" ? (
            "Sending…"
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send campaign
            </>
          )}
        </button>
      </div>
    </div>
  );
}
