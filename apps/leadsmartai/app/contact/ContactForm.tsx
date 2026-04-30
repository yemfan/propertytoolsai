"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Send } from "lucide-react";

/**
 * Public contact form on /contact.
 *
 * Doubles as the proof-of-consent surface required by Twilio's toll-free
 * verification (TFV) review. The phone field is OPTIONAL — leaving it
 * blank submits a contact request with no SMS opt-in. The SMS-consent
 * checkbox is also optional, but it's the ONLY way the user authorizes
 * receiving text messages from us; submitting without ticking it means
 * they get email follow-up only.
 *
 * The disclosure block below the checkbox includes the four elements
 * Twilio + the FCC TCPA expect to see at the point of opt-in:
 *
 *   1. WHO is sending — "LeadSmart AI"
 *   2. WHAT kinds of messages — "customer care + marketing"
 *   3. FREQUENCY — "message frequency varies"
 *   4. OPT-OUT + COST — "Reply STOP to opt out, message and data rates may apply"
 *
 * Don't change the disclosure copy without updating the verification
 * record submitted to Twilio. Re-verification is required when the
 * disclosure materially changes.
 */
/**
 * Topic-aware prefill. Marketing CTAs hand us a `?topic=...` query
 * param so sales can tell at a glance which surface drove the inquiry
 * (e.g. the Team pricing card vs. a generic "Contact us" link). Add
 * cases here as new topics get linked from the marketing pages —
 * unrecognized values fall through to the empty default.
 */
function prefillForTopic(topic: string | null): { subject: string; message: string } {
  switch (topic) {
    case "team":
      return {
        subject: "Team plan inquiry — more than 5 seats",
        message:
          "Hi LeadSmart team,\n\nI'm interested in the Team plan for my brokerage. We have ___ agents and would like to learn more about pricing, onboarding, and the Top Producer Track for the whole team.\n\n",
      };
    default:
      return { subject: "", message: "" };
  }
}

export default function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const searchParams = useSearchParams();
  const prefill = useMemo(
    () => prefillForTopic(searchParams?.get("topic") ?? null),
    [searchParams],
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");

    const fd = new FormData(e.currentTarget);
    const body = {
      name: String(fd.get("name") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      phone: String(fd.get("phone") ?? "").trim(),
      subject: String(fd.get("subject") ?? "").trim(),
      message: String(fd.get("message") ?? "").trim(),
      smsConsent: fd.get("smsConsent") === "on",
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to send");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/60 px-5 py-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <Send className="h-5 w-5 text-emerald-600" strokeWidth={2} />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-slate-900">Message sent!</h3>
        <p className="mt-1 text-sm text-slate-600">
          Thanks for reaching out. We&apos;ll get back to you within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="block text-sm font-medium text-slate-700">
            Name
          </label>
          <input
            id="contact-name"
            name="name"
            type="text"
            required
            placeholder="Your name"
            className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-[#0072ce] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0072ce]/20"
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-[#0072ce] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0072ce]/20"
          />
        </div>
      </div>

      <div>
        <label htmlFor="contact-phone" className="block text-sm font-medium text-slate-700">
          Phone <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          id="contact-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="(555) 123-4567"
          className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-[#0072ce] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0072ce]/20"
        />
      </div>

      <div>
        <label htmlFor="contact-subject" className="block text-sm font-medium text-slate-700">
          Subject
        </label>
        <input
          id="contact-subject"
          name="subject"
          type="text"
          required
          placeholder="How can we help?"
          defaultValue={prefill.subject}
          className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-[#0072ce] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0072ce]/20"
        />
      </div>

      <div>
        <label htmlFor="contact-message" className="block text-sm font-medium text-slate-700">
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={5}
          required
          placeholder="Tell us more about your question or feedback..."
          defaultValue={prefill.message}
          className="mt-1.5 block w-full resize-y rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-[#0072ce] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0072ce]/20"
        />
      </div>

      {/* SMS opt-in — Twilio TFV proof-of-consent surface. The four-element
          disclosure beneath the checkbox is required; do not edit without
          re-submitting verification. */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <label htmlFor="contact-sms-consent" className="flex cursor-pointer items-start gap-3">
          <input
            id="contact-sms-consent"
            name="smsConsent"
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#0072ce] focus:ring-[#0072ce]"
          />
          <span className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">
              Yes, send me text messages from LeadSmart AI.
            </span>{" "}
            By checking this box and providing my phone number above, I consent to
            receive text messages from <strong>LeadSmart AI</strong> for{" "}
            <strong>customer care and marketing</strong> related to real-estate
            services, account updates, and product information.
          </span>
        </label>
        <p className="mt-3 pl-7 text-xs leading-relaxed text-slate-500">
          Message frequency varies. Message and data rates may apply. Reply{" "}
          <strong>STOP</strong> to opt out at any time, or <strong>HELP</strong> for
          help. Consent is not a condition of any purchase. See our{" "}
          <a
            href="/privacy"
            className="font-medium text-[#0072ce] hover:underline"
          >
            Privacy Policy
          </a>{" "}
          and{" "}
          <a href="/terms" className="font-medium text-[#0072ce] hover:underline">
            Terms of Service
          </a>{" "}
          for details.
        </p>
      </div>

      {status === "error" && (
        <p className="text-sm font-medium text-rose-600">
          Something went wrong. Please try again or email us directly.
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex items-center gap-2 rounded-xl bg-[#0072ce] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#005ca8] disabled:opacity-60"
      >
        <Send className="h-4 w-4" strokeWidth={2} />
        {status === "sending" ? "Sending..." : "Send message"}
      </button>
    </form>
  );
}
