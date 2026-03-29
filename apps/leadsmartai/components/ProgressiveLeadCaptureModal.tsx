"use client";

import { useMemo, useState } from "react";

type Stage = "email" | "name" | "phone" | "done";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatUsPhone(input: string) {
  const digits = input.replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function isValidUsPhone(input: string) {
  return input.replace(/\D/g, "").length === 10;
}

export default function ProgressiveLeadCaptureModal(props: {
  open: boolean;
  onClose: () => void;
  address: string;
  source?: string;
  onUnlocked?: (info: { leadId: string; reportLink: string }) => void;
}) {
  const [stage, setStage] = useState<Stage>("email");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [reportLink, setReportLink] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => {
    if (stage === "email") return "Unlock full report";
    if (stage === "name") return "Personalize your report";
    if (stage === "phone") return "Get instant updates via SMS";
    return "All set";
  }, [stage]);

  function reset() {
    setStage("email");
    setLeadId(null);
    setReportLink(null);
    setEmail("");
    setName("");
    setPhone("");
    setLoading(false);
    setError(null);
  }

  async function captureEmail() {
    setError(null);
    if (!email.trim() || !isValidEmail(email.trim())) {
      setError("Please enter a valid email.");
      return;
    }
    if (!props.address.trim()) {
      setError("Address is missing. Please try again.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/leads/capture-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: props.address.trim(),
          email: email.trim(),
          source: props.source ?? "home_value",
        }),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error ?? "Failed to unlock report.");
      }
      setLeadId(String(json.leadId));
      setReportLink(String(json.reportLink));
      setStage("name");
      props.onUnlocked?.({ leadId: String(json.leadId), reportLink: String(json.reportLink) });
    } catch (e: any) {
      setError(e?.message ?? "Failed to unlock report.");
    } finally {
      setLoading(false);
    }
  }

  async function captureName() {
    setError(null);
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!leadId) {
      setError("Lead session missing. Please retry.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/leads/capture-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, name: name.trim() }),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error ?? "Failed to save name.");
      }
      setStage("phone");
    } catch (e: any) {
      setError(e?.message ?? "Failed to save name.");
    } finally {
      setLoading(false);
    }
  }

  async function capturePhone(highIntent = false) {
    setError(null);
    if (!phone.trim()) {
      setError("Please enter your phone number.");
      return;
    }
    if (!isValidUsPhone(phone)) {
      setError("Phone must be a valid US number (10 digits).");
      return;
    }
    if (!leadId) {
      setError("Lead session missing. Please retry.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/leads/capture-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, phone: phone.trim(), highIntent }),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error ?? "Failed to save phone.");
      }
      setStage("done");
    } catch (e: any) {
      setError(e?.message ?? "Failed to save phone.");
    } finally {
      setLoading(false);
    }
  }

  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate">{title}</div>
            <div className="text-xs text-slate-600 mt-1 truncate">{props.address}</div>
          </div>
          <button
            type="button"
            className="text-sm font-semibold px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50"
            onClick={() => {
              props.onClose();
              reset();
            }}
          >
            Close
          </button>
        </div>

        <div className="p-5 space-y-3">
          {stage === "email" ? (
            <>
              <div className="text-sm text-slate-700">
                Enter your email to unlock the full report.
              </div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                inputMode="email"
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={captureEmail}
                disabled={loading}
                className="w-full inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Unlocking..." : "Unlock Full Report"}
              </button>
            </>
          ) : null}

          {stage === "name" ? (
            <>
              <div className="text-sm text-slate-700">
                Enter your name to personalize your report.
              </div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <a
                  href={reportLink ?? "#"}
                  className={`flex-1 inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold border border-slate-200 hover:bg-slate-50 ${
                    reportLink ? "" : "pointer-events-none opacity-60"
                  }`}
                >
                  View report
                </a>
                <button
                  type="button"
                  onClick={captureName}
                  disabled={loading}
                  className="flex-1 inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? "Saving..." : "Continue"}
                </button>
              </div>
            </>
          ) : null}

          {stage === "phone" ? (
            <>
              <div className="text-sm text-slate-700">
                Get instant updates via SMS (optional, but recommended).
              </div>
              <input
                value={phone}
                onChange={(e) => setPhone(formatUsPhone(e.target.value))}
                placeholder="(555) 123-4567"
                inputMode="tel"
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => capturePhone(false)}
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? "Saving..." : "Save phone"}
                </button>
                <button
                  type="button"
                  onClick={() => capturePhone(true)}
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Talk to an agent
                </button>
                <button
                  type="button"
                  onClick={() => setStage("done")}
                  className="w-full inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold border border-slate-200 hover:bg-slate-50"
                >
                  Skip for now
                </button>
              </div>
            </>
          ) : null}

          {stage === "done" ? (
            <>
              <div className="text-sm font-semibold text-emerald-700">
                You&apos;re all set.
              </div>
              <div className="text-sm text-slate-700">
                Your full report is unlocked. You can view it anytime below.
              </div>
              <a
                href={reportLink ?? "#"}
                className={`w-full inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold border border-slate-200 hover:bg-slate-50 ${
                  reportLink ? "" : "pointer-events-none opacity-60"
                }`}
              >
                View your report
              </a>
            </>
          ) : null}

          {error ? <p className="text-xs text-red-600 font-medium">{error}</p> : null}
          <p className="text-[11px] text-slate-500">
            We save your progress at each step. No spam.
          </p>
        </div>
      </div>
    </div>
  );
}

