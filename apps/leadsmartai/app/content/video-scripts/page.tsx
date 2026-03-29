"use client";

import { useState } from "react";
import TrafficTracker from "@/components/TrafficTracker";

type Script = {
  hook: string;
  talkingPoints: string[];
  cta: string;
};

export default function VideoScriptsPage() {
  const [city, setCity] = useState("Austin");
  const [topic, setTopic] = useState("home value update");
  const [audience, setAudience] = useState("seller");
  const [loading, setLoading] = useState(false);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/content/video-scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, topic, audience }),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to generate scripts");
      setScripts(Array.isArray(json.scripts) ? json.scripts : []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to generate scripts");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <TrafficTracker pagePath="/content/video-scripts" source="content_strategy" />
      <h1 className="text-3xl font-bold text-slate-900">Short-Form Video Script Generator</h1>
      <p className="mt-2 text-slate-700">Generate hooks, talking points, and CTAs for real estate lead generation.</p>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <input
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City"
        />
        <input
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Topic"
        />
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
        >
          <option value="seller">Seller</option>
          <option value="buyer">Buyer</option>
          <option value="investor">Investor</option>
          <option value="general">General</option>
        </select>
      </div>
      <button
        onClick={generate}
        disabled={loading}
        className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? "Generating..." : "Generate Scripts"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-6 space-y-4">
        {scripts.map((s, idx) => (
          <article key={idx} className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Hook</h3>
            <p className="mt-1 text-sm text-slate-700">{s.hook}</p>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">Talking Points</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {s.talkingPoints?.map((tp, i) => (
                <li key={i}>{tp}</li>
              ))}
            </ul>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">CTA</h3>
            <p className="mt-1 text-sm text-slate-700">{s.cta}</p>
          </article>
        ))}
      </div>
    </main>
  );
}

