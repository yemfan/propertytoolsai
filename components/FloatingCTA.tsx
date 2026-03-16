"use client";

import { FormEvent, useState } from "react";

export default function FloatingCTA() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });

      if (!res.ok) {
        console.error("Failed to submit contact form");
      } else {
        setSubmitted(true);
      }
    } catch (err) {
      console.error("Error submitting contact form", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <aside className="fixed inset-x-4 bottom-4 z-50 sm:inset-x-auto sm:right-6 sm:bottom-6 max-w-sm">
      <div className="bg-white shadow-lg rounded-xl border border-blue-100 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">
          Need help buying in Los Angeles?
        </h2>
        <p className="text-xs text-gray-600 mb-3">
          Talk to a local agent about your next home or investment property. Share a few
          details and we&apos;ll reach out to schedule a call.
        </p>

        {submitted ? (
          <p className="text-xs text-green-700 font-semibold">
            Thank you! We&apos;ll review your details and follow up shortly.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                required
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-1/2 rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-1/2 rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <textarea
              rows={2}
              placeholder="What are you looking to buy?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex justify-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            >
              {isSubmitting ? "Sending..." : "Schedule Call"}
            </button>
          </form>
        )}
      </div>
    </aside>
  );
}

