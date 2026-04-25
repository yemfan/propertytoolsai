"use client";

import { useState } from "react";
import {
  SCRIPT_KINDS,
  type SalesModel,
  type ScriptKind,
} from "@/lib/sales-models";

/**
 * Script Generator.
 *
 * Calls `POST /api/sales-model/generate-script` (real LLM under the
 * hood) so the output reasons about the agent's actual situation,
 * not just substring-substitutes it into a template. The route
 * applies the model's identity + tone as the system prompt and asks
 * the LLM to *classify* what kind of message the situation calls
 * for (DM reply / follow-up / objection handling / appointment
 * setting / consultation opening) before generating it.
 *
 * The classification comes back as `detectedKind` so we can show
 * the agent the AI's read on the situation — useful both as a
 * confidence signal and as feedback when the read is wrong (so the
 * agent can rephrase the situation).
 *
 * Fallback to local templates is preserved for two cases:
 *   1. AI is not configured on the environment (preview / dev
 *      without an OpenAI key) — route returns 503 `ai_unconfigured`,
 *      we render the local template so the screen remains useful.
 *   2. The agent has hit their AI quota (402) — we surface the
 *      error inline AND render the local template as a degraded
 *      output so they can still get *something* without going to
 *      billing.
 *
 * Every other failure (network, 500, malformed body) shows an
 * error and lets the user retry.
 */
export function ScriptGenerator({ model }: { model: SalesModel }) {
  const [situation, setSituation] = useState("");
  const [output, setOutput] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"ai" | "fallback" | null>(null);
  const [detectedKind, setDetectedKind] = useState<ScriptKind | null>(null);

  const onGenerate = async () => {
    const trimmed = situation.trim();
    if (!trimmed) {
      setError("Describe the situation first — the AI uses it to tailor the script.");
      return;
    }
    setBusy(true);
    setError(null);
    setOutput(null);
    setDetectedKind(null);
    setSource(null);

    try {
      const res = await fetch("/api/sales-model/generate-script", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        // No `kind` — the API auto-classifies and returns its pick
        // as `detectedKind` so we can show the agent what the AI read.
        body: JSON.stringify({ situation: trimmed, salesModel: model.id }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        script?: string;
        detectedKind?: string | null;
        source?: "ai" | "fallback";
        error?: string;
        code?: string;
      } | null;

      if (res.ok && json?.ok && typeof json.script === "string" && json.script.trim()) {
        setOutput(json.script.trim());
        setSource(json.source ?? "ai");
        // Trust the model's classification only if it's a known kind.
        const dk = json.detectedKind;
        const dkValid =
          typeof dk === "string" &&
          (SCRIPT_KINDS.find((k) => k.value === dk)?.value ?? null);
        setDetectedKind((dkValid as ScriptKind) ?? null);
        return;
      }

      // Soft-fail to local template only for "AI unavailable on this
      // env" or "out of quota". Hard errors (auth, validation) get
      // surfaced — the local template wouldn't fix them.
      const code = json?.code;
      if (code === "ai_unconfigured" || res.status === 402) {
        const local = generateLocalScript({ model, situation: trimmed });
        setOutput(local);
        setSource("fallback");
        if (code === "ai_unconfigured") {
          setError(
            "AI is not configured on this environment — showing a template instead. Set OPENAI_API_KEY to enable AI.",
          );
        } else {
          setError(json?.error ?? "AI quota reached — showing a template instead.");
        }
        return;
      }

      setError(json?.error ?? `Could not generate script (HTTP ${res.status}).`);
    } catch (e) {
      // Network error — fall back to local template so the agent
      // isn't stuck staring at a spinner-then-error.
      const local = generateLocalScript({ model, situation: trimmed });
      setOutput(local);
      setSource("fallback");
      setError(
        e instanceof Error
          ? `Network error: ${e.message} — showing a template instead.`
          : "Network error — showing a template instead.",
      );
    } finally {
      setBusy(false);
    }
  };

  const onCopy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
    } catch {
      // Clipboard unavailable — user can select-all manually.
    }
  };

  const detectedLabel = detectedKind
    ? SCRIPT_KINDS.find((k) => k.value === detectedKind)?.label
    : null;

  return (
    <section
      aria-label="Script generator"
      className="rounded-2xl border border-slate-200 bg-white p-6 ring-1 ring-slate-900/[0.04] shadow-sm"
    >
      <header className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">Script Generator</h2>
        <p className="mt-1 text-sm text-slate-600">
          Describe the situation — the AI figures out what kind of message
          you need (DM reply, follow-up, objection, appointment, opener) and
          writes it in your{" "}
          <span className="font-medium text-slate-800">{model.name}</span> tone.
        </p>
      </header>

      <div>
        <label
          htmlFor="script-situation"
          className="block text-xs font-semibold uppercase tracking-wider text-slate-500"
        >
          Describe the situation
        </label>
        <textarea
          id="script-situation"
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
          placeholder="e.g. I have a buyer named Mary. I want to set an initial appointment, but she said interest rates are too high and prices are falling, so she wants to wait."
          rows={4}
          className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <p className="mt-1.5 text-xs text-slate-500">
          Include the lead's name, what you want from this message, and any
          context they've shared (objections, timeline, etc.).
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void onGenerate()}
          disabled={busy}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? "Generating…" : "Generate Script"}
        </button>
        {output ? (
          <button
            type="button"
            onClick={onCopy}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          >
            Copy
          </button>
        ) : null}
        {source ? (
          <span
            className={[
              "ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
              source === "ai"
                ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200"
                : "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200",
            ].join(" ")}
          >
            {source === "ai" ? "AI-generated" : "Template fallback"}
          </span>
        ) : null}
        {detectedLabel ? (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
            Read as: {detectedLabel}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </div>
      ) : null}

      {output ? (
        <pre className="mt-4 max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800">
          {output}
        </pre>
      ) : null}
    </section>
  );
}

/**
 * Local fallback generator — used when the AI route returns 503
 * (`ai_unconfigured`) or 402 (quota), or on network failure. The
 * online path goes through `/api/sales-model/generate-script` which
 * actually classifies the situation and reasons about it; this
 * function just gives the agent something tone-correct when AI
 * isn't available so they aren't stuck on an error.
 *
 * One template per model (no per-kind branching since the user no
 * longer picks a kind). The structure is intentionally generic
 * (acknowledge → context → ask), tuned only for tone — agents will
 * paraphrase before sending in the rare case this fires.
 */
function generateLocalScript({
  model,
  situation,
}: {
  model: SalesModel;
  situation: string;
}): string {
  const ctx = situation || "what you're working through";
  switch (model.id) {
    case "advisor":
      return `Thanks for sharing the context — happy to think through this with you.

Quick read on the situation: ${ctx}. There are usually two or three angles worth checking before we make any decisions, and the most useful next step is usually a short call where we line them up against your actual goal.

Open to a 15-minute call this week, or would a written summary be more useful first? Either works.`;
    case "closer":
      return `Quick note on this: ${ctx}.

Three questions: are you actively looking right now? Has anything shifted on your timeline? And what would make this an obvious yes vs. an obvious wait?

I have time tomorrow at 10am or 2pm — which works better for a 15-minute call?`;
    case "influencer":
      return `Heyyy 👋 thanks for the context!

Okay so on ${ctx} — this comes up a lot and there's actually a really helpful way to think about it that most people don't know. I'll send a quick voice note with my take if that's easier, or we can hop on a 10-min call. Whatever feels good 💛`;
    case "custom":
      return `Thanks for the context. Here's how I'd suggest we move forward:

Based on the situation (${ctx}), the most useful next step is a short conversation to align on what you're trying to accomplish and the constraints we should plan around.

I have a few openings this week — Tuesday 10am, Wednesday 2pm, or Thursday 4pm. Which works best?`;
  }
}
