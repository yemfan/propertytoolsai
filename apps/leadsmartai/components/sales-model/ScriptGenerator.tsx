"use client";

import { useMemo, useState } from "react";
import {
  SCRIPT_KINDS,
  type SalesModel,
  type ScriptKind,
} from "@/lib/sales-models";

/**
 * Script Generator.
 *
 * Picks the right template for the (model, kind) pair and fills in
 * the agent's situation. Pure local logic for MVP — no LLM call —
 * which keeps the screen useful even when the AI quota is exhausted
 * and lets us ship without an OpenAI / Anthropic dependency in this
 * PR. The wire is set up so swapping the local template for a real
 * model call later is a one-function change in `generateScript`.
 *
 * The four model branches encode the *tone* (calm / direct / energetic
 * / neutral) — the kind picks the *structure* (greeting → ack → value
 * → CTA, etc.). This 4×5 matrix produces 20 deliberately-different
 * outputs without hand-writing 20 templates.
 */
export function ScriptGenerator({ model }: { model: SalesModel }) {
  const [kind, setKind] = useState<ScriptKind>("dm_reply");
  const [situation, setSituation] = useState("");
  const [output, setOutput] = useState<string | null>(null);

  const placeholder = useMemo(() => placeholderFor(kind), [kind]);

  const onGenerate = () => {
    const trimmed = situation.trim();
    setOutput(generateScript({ model, kind, situation: trimmed }));
  };

  const onCopy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
    } catch {
      // Clipboard unavailable — user can select-all manually.
    }
  };

  return (
    <section
      aria-label="Script generator"
      className="rounded-2xl border border-slate-200 bg-white p-6 ring-1 ring-slate-900/[0.04] shadow-sm"
    >
      <header className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">Script Generator</h2>
        <p className="mt-1 text-sm text-slate-600">
          Pick the script type and describe the situation — the output is
          tuned to your <span className="font-medium text-slate-800">{model.name}</span> tone.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[200px_1fr]">
        <div>
          <label
            htmlFor="script-kind"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-500"
          >
            Script type
          </label>
          <select
            id="script-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as ScriptKind)}
            className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {SCRIPT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>

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
            placeholder={placeholder}
            rows={4}
            className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onGenerate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Generate Script
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
      </div>

      {output ? (
        <pre className="mt-4 max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800">
          {output}
        </pre>
      ) : null}
    </section>
  );
}

function placeholderFor(kind: ScriptKind): string {
  switch (kind) {
    case "dm_reply":
      return "e.g. Buyer DM'd asking about a 2-bed condo near the lake — they're new to the area.";
    case "follow_up":
      return "e.g. Spoke 2 weeks ago about a townhouse but no reply since.";
    case "objection_handling":
      return "e.g. They said the asking price feels too high vs. comps they've seen on Zillow.";
    case "appointment_setting":
      return "e.g. Qualified buyer ready to tour 3 properties this Saturday.";
    case "consultation_opening":
      return "e.g. First-time buyer, relocating from another city, wants help understanding the process.";
  }
}

/**
 * The local template engine. (model, kind) selects the structure +
 * tone; situation is woven in as the lead context.
 *
 * Output shape is deliberately copy-and-send ready — no [BRACKET]
 * placeholders the agent has to remember to fill. If the situation
 * is empty we still produce a complete script using a generic stand-in
 * so the agent gets a structural example.
 */
function generateScript({
  model,
  kind,
  situation,
}: {
  model: SalesModel;
  kind: ScriptKind;
  situation: string;
}): string {
  const ctx = situation || "the lead's current question";
  switch (model.id) {
    case "advisor":
      return advisorScript(kind, ctx);
    case "closer":
      return closerScript(kind, ctx);
    case "influencer":
      return influencerScript(kind, ctx);
    case "custom":
      return customScript(kind, ctx);
  }
}

// ── Advisor — calm, analytical, trust-based ──────────────────────

function advisorScript(kind: ScriptKind, ctx: string): string {
  switch (kind) {
    case "dm_reply":
      return `Thanks for reaching out — happy to think through this with you.

Quick read on what you mentioned (${ctx}): there are usually two or three angles worth checking before we make any decisions. The biggest one is whether the timing aligns with your overall plan — happy to walk you through what I'd look at.

Want me to send over a 2-page brief tailored to your situation, or would a 15-minute call be easier? Either works.`;
    case "follow_up":
      return `Hi — circling back on the conversation we started about ${ctx}. No pressure on timing.

Two things have shifted in the market since we last spoke that might be worth a 10-minute review. I'll keep it brief and you can decide if it's worth a deeper look.

Open to a quick call this week, or would a written summary be more useful?`;
    case "objection_handling":
      return `That's a fair concern — and honestly, it's the right question to ask. Here's how I'd think about ${ctx}:

There are usually three drivers behind that gap: comparables that aren't truly comparable, condition adjustments most buyers underestimate, and timing of the data itself.

What I'd suggest: let me pull a side-by-side of the 5 closest real comps with the adjustments factored in. That'll give you a number you can defend either way — and if the gap is real, we'll see it clearly.`;
    case "appointment_setting":
      return `Great — given what you've shared about ${ctx}, the most useful next step is a 30-minute strategy call.

Goal of the call: get clear on your decision criteria, identify the two or three risks worth managing, and leave you with a written plan you can act on either with me or independently.

I have Tuesday at 10am or Thursday at 4pm open. Which works?`;
    case "consultation_opening":
      return `Thanks for taking the time today. Here's how I usually run these — feel free to redirect at any point.

I want to spend the first 10 minutes understanding ${ctx} — what you're trying to accomplish, the timeline, and the constraints. Then I'll share what I'd recommend looking at, what I'd avoid, and what the next 30 days could look like.

Worst case, you walk away with a clearer plan. Sound fair?`;
  }
}

// ── Closer — direct, structured, action-oriented ─────────────────

function closerScript(kind: ScriptKind, ctx: string): string {
  switch (kind) {
    case "dm_reply":
      return `Hi — got your message about ${ctx}.

Quick yes/no: are you actively looking right now, or just gathering info?

If active, I have time tomorrow at 10am or 2pm for a 15-minute call. Which works?`;
    case "follow_up":
      return `Quick follow-up — last time we spoke about ${ctx}.

Three quick questions: still in the market? Still on the same timeline? Anything change?

I have two slots open this week — Wednesday 11am or Friday 3pm. Which is easier for you?`;
    case "objection_handling":
      return `I hear you on ${ctx}. Let me ask you this: if I could show you that the number actually makes sense once you factor in [X], would that change how you're thinking about it?

Here's what most buyers in your position do — they ask for the side-by-side, they look at it, and they either move forward with confidence or walk away knowing why.

Want me to send the side-by-side over today?`;
    case "appointment_setting":
      return `Based on what you told me about ${ctx}, the next step is a property tour.

I have three homes that match what you described. We can see all three in 90 minutes.

Saturday 10am works on my end. Does that work for you, or is Sunday afternoon better?`;
    case "consultation_opening":
      return `Appreciate you making time. I'll keep this tight — 30 minutes, three sections.

Section one: what you're trying to accomplish around ${ctx}.
Section two: what I've seen work and what I've seen waste time.
Section three: agree on the next two actions and who does what by when.

Sound good? Let's start with what triggered you to reach out today.`;
  }
}

// ── Influencer — friendly, energetic, social-first ───────────────

function influencerScript(kind: ScriptKind, ctx: string): string {
  switch (kind) {
    case "dm_reply":
      return `Hey hey 👋 thanks for the DM!

Okay so on ${ctx} — totally a question I get all the time, and there's actually a really cool way to think about it that most people don't know.

I'll send over a quick voice note with my take if that's easier? Or we can hop on a 10-min call. Whatever feels good 💛`;
    case "follow_up":
      return `Heyyy 👋 popping back in because I just thought of you 🙂

Last we chatted about ${ctx} — I've actually got a fresh take I think you'll love. Want me to send over a quick video?

No pressure either way, just keeping you in the loop because I know timing can shift fast in this market.`;
    case "objection_handling":
      return `Totally hear you on ${ctx} — and honestly? Smart to push back on that.

Here's the thing most people don't realize though: there's usually a story behind the number that completely changes how you read it. Let me show you what I mean — I'll record a quick walk-through and you can decide.

Real talk — if it doesn't add up after seeing it, I'll be the first one to tell you to walk 💯`;
    case "appointment_setting":
      return `Okay love this — based on what you said about ${ctx}, I want to set you up with a tour that actually shows you what's possible.

I've handpicked three places I think you'll get genuinely excited about. Saturday morning we make it a vibe — coffee, tour, real talk.

10am Saturday? Or hit me with what works for you ✨`;
    case "consultation_opening":
      return `Sooo glad you made it 🎉

Quick game plan for today — I want to actually understand what you're trying to do with ${ctx}, share the inside-baseball stuff people don't usually tell you, and leave you feeling 100x more confident than when you got on this call.

You don't need to have all the answers — that's literally my job. So let's just talk. What's the thing that's been on your mind the most?`;
  }
}

// ── Custom — neutral, tone-agnostic ──────────────────────────────
//
// Default to a clean, professional voice that doesn't impose any
// particular persona. The agent can edit freely.

function customScript(kind: ScriptKind, ctx: string): string {
  switch (kind) {
    case "dm_reply":
      return `Hi — thanks for reaching out about ${ctx}.

Happy to help. To make sure I send you the most useful info, could you share a couple of details: timeline, area you're focused on, and any must-haves?

Once I have that, I'll get back to you with a clear next step.`;
    case "follow_up":
      return `Hi — following up on our earlier conversation about ${ctx}.

Wanted to check in to see if anything has shifted on your end, and to share an update from my side that may be relevant.

Let me know if a quick call this week makes sense, or if email is easier — both work for me.`;
    case "objection_handling":
      return `Thanks for raising that — it's a reasonable concern about ${ctx}.

Here's how I'd suggest we work through it: let's look at the actual data side-by-side and walk through the assumptions. If the concern still holds up after that, we adjust the plan; if not, we move forward with more confidence.

I can put that together and send it over today. Want me to proceed?`;
    case "appointment_setting":
      return `Based on what you've shared about ${ctx}, the next step is a 30-minute call to align on the plan.

I have a few options open — Tuesday 10am, Wednesday 2pm, or Thursday 4pm. Which works best for you?

If none of those fit, send me two times that work and I'll confirm.`;
    case "consultation_opening":
      return `Thanks for the time today. Here's how I'd suggest we use it:

First, I'd like to understand your situation — specifically ${ctx} — so I can give you advice that actually fits your case. Then I'll share what I'd recommend, including what I'd avoid, and we'll agree on a clear next step.

Feel free to interrupt at any point. Where would you like to start?`;
  }
}
