"use client";

import { useState } from "react";

/**
 * Minimal contact form. POSTs to /api/contact (existing endpoint that sends
 * via SMTP). State machine: idle → submitting → (success | error). The
 * email-link fallback in the parent page ensures users still have a path
 * forward if the form submission fails.
 */
export default function ContactForm({ supportEmail }: { supportEmail: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("Support");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setStatus("error");
      setErrorMsg("Name, email, and message are required.");
      return;
    }
    setStatus("submitting");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: `[${subject}] ${message.trim()}`,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Send failed");
      }
      setStatus("success");
      setName("");
      setEmail("");
      setSubject("Support");
      setMessage("");
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Send failed");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
        <div className="font-semibold">Thanks — your message is on its way.</div>
        <p className="mt-1">We&apos;ll reply within one business day. If you need a faster response, email{" "}
          <a href={`mailto:${supportEmail}`} className="font-medium text-emerald-800 underline">
            {supportEmail}
          </a>{" "}
          directly.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-3 text-xs font-medium text-emerald-800 underline"
        >
          Send another message
        </button>
      </div>
    );
  }

  const submitting = status === "submitting";

  return (
    <form onSubmit={submit} className="space-y-3 text-sm" noValidate>
      <div>
        <label htmlFor="contact-name" className="block text-xs font-medium text-slate-600">
          Name
        </label>
        <input
          id="contact-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0072ce]/40"
        />
      </div>
      <div>
        <label htmlFor="contact-email" className="block text-xs font-medium text-slate-600">
          Email
        </label>
        <input
          id="contact-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0072ce]/40"
        />
      </div>
      <div>
        <label htmlFor="contact-subject" className="block text-xs font-medium text-slate-600">
          Topic
        </label>
        <select
          id="contact-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0072ce]/40"
        >
          <option>Support</option>
          <option>Bad home value estimate</option>
          <option>Partnership inquiry</option>
          <option>Press / media</option>
          <option>Feedback</option>
          <option>Other</option>
        </select>
      </div>
      <div>
        <label htmlFor="contact-message" className="block text-xs font-medium text-slate-600">
          Message
        </label>
        <textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          required
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0072ce]/40"
        />
      </div>

      {status === "error" && errorMsg ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {errorMsg} You can also email{" "}
          <a href={`mailto:${supportEmail}`} className="font-medium underline">
            {supportEmail}
          </a>
          .
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex rounded-lg bg-[#0072ce] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#005ca8] disabled:opacity-60"
      >
        {submitting ? "Sending…" : "Send message"}
      </button>

      <p className="text-[11px] leading-relaxed text-slate-500">
        By sending this message you agree to our{" "}
        <a href="/privacy" className="underline hover:text-[#0072ce]">
          Privacy Policy
        </a>
        . We&apos;ll use your email only to respond.
      </p>
    </form>
  );
}
