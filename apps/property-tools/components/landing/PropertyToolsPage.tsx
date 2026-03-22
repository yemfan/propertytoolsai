"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { trackEvent } from "@/lib/marketing/trackEvent";

const LEADSMART_URL = process.env.NEXT_PUBLIC_LEADSMART_URL ?? "https://leadsmart.ai";

const tools = [
  {
    title: "Home Value Estimator",
    desc: "Find out what your home is worth instantly",
    href: "/home-value",
    id: "home_value",
  },
  {
    title: "Mortgage Calculator",
    desc: "Estimate your monthly payment in seconds",
    href: "/mortgage-calculator",
    id: "mortgage",
  },
  {
    title: "AI Property Comparison",
    desc: "Compare properties and find the best deal",
    href: "/ai-property-comparison",
    id: "compare",
  },
  {
    title: "Refinance Analyzer",
    desc: "See if refinancing saves you money",
    href: "/refinance-calculator",
    id: "refinance",
  },
] as const;

export default function PropertyToolsPage() {
  const [email, setEmail] = useState("");
  const [leadStatus, setLeadStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [leadMessage, setLeadMessage] = useState<string | null>(null);

  const onLeadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLeadMessage(null);
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setLeadStatus("error");
      setLeadMessage("Please enter a valid email.");
      return;
    }

    trackEvent("lead_capture", { source: "property_tools_page" });
    setLeadStatus("loading");

    try {
      const res = await fetch("/api/leads/tool-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed.split("@")[0] || "Subscriber",
          email: trimmed,
          source: "property_tools_page",
          tool: "detailed_insights",
          intent: "buy",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setLeadStatus("error");
        setLeadMessage(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setLeadStatus("ok");
      setLeadMessage("Check your inbox soon.");
      setEmail("");
    } catch {
      setLeadStatus("error");
      setLeadMessage("Network error. Please try again.");
    }
  };

  return (
    <main className="bg-white text-gray-900">
      {/* HERO */}
      <section id="hero" className="mx-auto max-w-7xl px-6 py-20 text-center">
        <h1 className="text-4xl font-bold md:text-5xl">
          Smarter Tools to Help You Buy, Sell, or Finance a Home
        </h1>
        <p className="mt-4 text-xl text-gray-600">
          Instantly check your home value, compare properties, and estimate your mortgage — all powered by AI.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Button
            href="/home-value"
            onClick={() => trackEvent("tool_click", { tool: "home_value", href: "/home-value" })}
          >
            Check Your Home Value
          </Button>
          <Button
            href="/mortgage-calculator"
            variant="outline"
            onClick={() => trackEvent("tool_click", { tool: "mortgage", href: "/mortgage-calculator" })}
          >
            Calculate Mortgage
          </Button>
          <Button
            href="/ai-property-comparison"
            variant="outline"
            onClick={() => trackEvent("tool_click", { tool: "compare", href: "/ai-property-comparison" })}
          >
            Compare Properties
          </Button>
        </div>
        <p className="mt-4 text-gray-500">Trusted by home buyers, sellers, and investors</p>
      </section>

      {/* TOOL GRID */}
      <section id="tools" className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-16 md:grid-cols-2 lg:grid-cols-4">
        {tools.map((tool) => (
          <Card key={tool.id} className="transition hover:-translate-y-0.5 hover:shadow-xl">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold">{tool.title}</h3>
              <p className="mt-2 text-gray-600">{tool.desc}</p>
              <Button
                href={tool.href}
                className="mt-4 w-full"
                onClick={() => trackEvent("tool_click", { tool: tool.id, href: tool.href })}
              >
                Try Now
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* PAIN */}
      <section id="pain" className="bg-gray-50 px-6 py-16 text-center">
        <h2 className="text-3xl font-semibold">Avoid Costly Real Estate Mistakes</h2>
        <p className="mx-auto mt-6 max-w-2xl text-gray-600">
          Most people rely on outdated estimates, guesswork, and incomplete data. That leads to bad decisions — and lost
          money.
        </p>
      </section>

      {/* AI VALUE */}
      <section id="ai-value" className="px-6 py-16 text-center">
        <h2 className="text-3xl font-semibold">Make Smarter Decisions with AI</h2>
        <div className="mx-auto mt-6 grid max-w-4xl grid-cols-1 gap-4 text-left md:grid-cols-2">
          <p>✔ Real-time data insights</p>
          <p>✔ AI-powered recommendations</p>
          <p>✔ Compare options instantly</p>
          <p>✔ No agent required (but available if needed)</p>
        </div>
      </section>

      {/* FEATURED TOOL */}
      <section id="featured" className="bg-gray-50 px-6 py-16 text-center">
        <h2 className="text-3xl font-semibold">AI Property Comparison</h2>
        <p className="mx-auto mt-4 max-w-2xl text-gray-600">
          Let AI analyze price, location, investment potential, and monthly cost to find the best property.
        </p>
        <Button
          href="/ai-property-comparison"
          className="mt-6"
          onClick={() => trackEvent("tool_click", { tool: "compare_feature", href: "/ai-property-comparison" })}
        >
          Try AI Property Comparison
        </Button>
      </section>

      {/* LEAD CAPTURE */}
      <section id="lead" className="px-6 py-16 text-center">
        <h2 className="text-3xl font-semibold">Get More Accurate Results</h2>
        <p className="mt-4 text-gray-600">Enter your email to unlock detailed insights</p>
        <form
          onSubmit={onLeadSubmit}
          className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-center sm:gap-2"
        >
          <Input
            type="email"
            autoComplete="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={leadStatus === "loading"} className="shrink-0 sm:w-auto">
            {leadStatus === "loading" ? "Sending…" : "Get My Report"}
          </Button>
        </form>
        {leadMessage ? (
          <p className={`mt-3 text-sm ${leadStatus === "ok" ? "text-emerald-600" : "text-red-600"}`}>{leadMessage}</p>
        ) : null}
      </section>

      {/* SOCIAL PROOF */}
      <section id="proof" className="bg-gray-50 px-6 py-16 text-center">
        <h2 className="text-3xl font-semibold">What Users Say</h2>
        <div className="mx-auto mt-6 max-w-xl space-y-6 text-gray-600">
          <p>
            &ldquo;Super helpful before buying my first home&rdquo;
            <span className="mt-1 block text-sm font-medium text-[#0072ce]">— Buyer</span>
          </p>
          <p>
            &ldquo;Helped me compare properties easily&rdquo;
            <span className="mt-1 block text-sm font-medium text-[#0072ce]">— Investor</span>
          </p>
          <p>
            &ldquo;Way better than guessing online&rdquo;
            <span className="mt-1 block text-sm font-medium text-[#0072ce]">— Homeowner</span>
          </p>
        </div>
      </section>

      {/* CROSS SELL */}
      <section id="cross-sell" className="px-6 py-16 text-center">
        <h2 className="text-3xl font-semibold">Are You an Agent?</h2>
        <p className="mx-auto mt-4 max-w-lg text-gray-600">
          Use LeadSmart AI to turn traffic like this into real deals.
        </p>
        <a
          href={LEADSMART_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses("default", "default", "mt-6")}
          onClick={() => trackEvent("tool_click", { tool: "leadsmart_cross_sell", href: LEADSMART_URL })}
        >
          Learn More
        </a>
      </section>

      {/* FINAL CTA */}
      <section id="cta" className="bg-gray-900 py-20 text-center text-white">
        <h2 className="text-3xl font-semibold">Start Making Smarter Decisions Today</h2>
        <p className="mt-4 text-gray-300">Free. Fast. AI-powered.</p>
        <Button
          href="#tools"
          variant="outline"
          className="mt-6 border-white bg-white text-gray-900 hover:bg-gray-100"
          onClick={() => trackEvent("tool_click", { tool: "final_cta", href: "#tools" })}
        >
          Try a Tool Now
        </Button>
      </section>

      {/* FOOTER */}
      <footer className="py-10 text-center text-gray-500">
        <p>© {new Date().getFullYear()} PropertyToolsAI</p>
        <nav className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <Link href="#tools" className="hover:text-[#0072ce]">
            Tools
          </Link>
          <Link href="/blog" className="hover:text-[#0072ce]">
            Blog
          </Link>
          <Link href="/contact" className="hover:text-[#0072ce]">
            Contact
          </Link>
          <Link href="/privacy" className="hover:text-[#0072ce]">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-[#0072ce]">
            Terms
          </Link>
        </nav>
      </footer>
    </main>
  );
}
