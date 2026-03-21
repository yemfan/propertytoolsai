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

  return null;
}

