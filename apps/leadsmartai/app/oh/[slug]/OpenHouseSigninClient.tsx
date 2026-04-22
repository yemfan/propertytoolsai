"use client";

import { useState } from "react";
import type { PublicOpenHouseInfo } from "@/lib/open-houses/publicService";
import type {
  VisitorBuyerStatus,
  VisitorTimeline,
} from "@/lib/open-houses/types";

/**
 * Mobile-first open-house sign-in form. No auth — agent shares the
 * URL via QR. Big tap targets, minimal scroll on a phone.
 *
 * Post-submit: we show a friendly confirmation. Agent can tap "Sign
 * in another visitor" to reset and hand off to the next person.
 */
export function OpenHouseSigninClient({ info }: { info: PublicOpenHouseInfo }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isBuyerAgented, setIsBuyerAgented] = useState(false);
  const [buyerAgentName, setBuyerAgentName] = useState("");
  const [buyerAgentBrokerage, setBuyerAgentBrokerage] = useState("");
  const [timeline, setTimeline] = useState<VisitorTimeline | "">("");
  const [buyerStatus, setBuyerStatus] = useState<VisitorBuyerStatus | "">("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!name.trim() && !email.trim() && !phone.trim()) {
      setError("Please enter at least your name, email, or phone.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/open-house/${info.slug}/signin`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          isBuyerAgented,
          buyerAgentName: isBuyerAgented ? buyerAgentName.trim() || null : null,
          buyerAgentBrokerage:
            isBuyerAgented ? buyerAgentBrokerage.trim() || null : null,
          timeline: timeline || null,
          buyerStatus: buyerStatus || null,
          marketingConsent,
          notes: null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !body.ok) {
        setError(body.error ?? "Sign-in failed. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForNext() {
    setName("");
    setEmail("");
    setPhone("");
    setIsBuyerAgented(false);
    setBuyerAgentName("");
    setBuyerAgentBrokerage("");
    setTimeline("");
    setBuyerStatus("");
    setMarketingConsent(false);
    setSubmitted(false);
    setError(null);
  }

  const locationLine = [info.city, info.state, info.zip].filter(Boolean).join(", ");

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
          <div className="text-5xl">✅</div>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">
            Thanks for signing in!
          </h1>
          <p className="mt-2 text-slate-600">
            {info.hostAgentFirstName
              ? `${info.hostAgentFirstName} is around — feel free to ask questions about the home.`
              : "Feel free to walk around and explore the home."}
          </p>
          <button
            type="button"
            onClick={resetForNext}
            className="mt-6 w-full rounded-xl bg-slate-900 px-6 py-3 text-base font-semibold text-white hover:bg-slate-800"
          >
            Sign in another visitor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-md space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">
            Open House
          </div>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            {info.propertyAddress}
          </h1>
          {locationLine ? (
            <div className="text-sm text-slate-600">{locationLine}</div>
          ) : null}
          {info.listPrice ? (
            <div className="mt-2 text-lg font-semibold text-slate-900">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(info.listPrice)}
            </div>
          ) : null}
          {info.mlsUrl ? (
            <a
              href={info.mlsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-sm text-blue-600 hover:underline"
            >
              View listing →
            </a>
          ) : null}
          {info.hostAgentFirstName ? (
            <p className="mt-3 text-sm text-slate-500">
              Hosted by {info.hostAgentFirstName}
              {info.hostAgentHeadline ? ` · ${info.hostAgentHeadline}` : ""}
            </p>
          ) : null}
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Your name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              inputMode="email"
              autoComplete="email"
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Are you working with an agent?
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsBuyerAgented(false)}
                className={`rounded-xl border px-3 py-3 text-base font-medium ${
                  !isBuyerAgented
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                No
              </button>
              <button
                type="button"
                onClick={() => setIsBuyerAgented(true)}
                className={`rounded-xl border px-3 py-3 text-base font-medium ${
                  isBuyerAgented
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                Yes
              </button>
            </div>
          </div>

          {isBuyerAgented ? (
            <div className="space-y-3 rounded-xl bg-slate-50 p-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Your agent&apos;s name
                </label>
                <input
                  value={buyerAgentName}
                  onChange={(e) => setBuyerAgentName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Brokerage
                </label>
                <input
                  value={buyerAgentBrokerage}
                  onChange={(e) => setBuyerAgentBrokerage(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base"
                />
              </div>
            </div>
          ) : null}

          <div>
            <label className="block text-sm font-medium text-slate-700">
              When are you looking to buy?
            </label>
            <select
              value={timeline}
              onChange={(e) => setTimeline(e.target.value as VisitorTimeline | "")}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base"
            >
              <option value="">—</option>
              <option value="now">Actively looking</option>
              <option value="3_6_months">In 3-6 months</option>
              <option value="6_12_months">In 6-12 months</option>
              <option value="later">Just exploring for later</option>
              <option value="just_looking">Just curious</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              You are…
            </label>
            <select
              value={buyerStatus}
              onChange={(e) => setBuyerStatus(e.target.value as VisitorBuyerStatus | "")}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base"
            >
              <option value="">—</option>
              <option value="looking">An active buyer</option>
              <option value="just_browsing">Just browsing</option>
              <option value="neighbor">A neighbor</option>
              <option value="other">Other</option>
            </select>
          </div>

          {!isBuyerAgented ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className="mt-1 h-5 w-5"
              />
              <span className="text-sm text-slate-700">
                Send me similar listings and follow-up info. You can unsubscribe anytime.
              </span>
            </label>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="w-full rounded-xl bg-slate-900 px-6 py-4 text-lg font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-center text-[11px] text-slate-400">
            Powered by LeadSmart AI
          </p>
        </div>
      </div>
    </div>
  );
}
