import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseServer } from "@/lib/supabaseServer";
import OpenAI from "openai";

export const runtime = "nodejs";

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

async function getAgentContext(agentId: string) {
  const [leadsRes, tasksRes, eventsRes] = await Promise.all([
    supabaseServer
      .from("leads")
      .select("id, name, email, phone, property_address, rating, lead_status, engagement_score, last_contacted_at, pipeline_stage_id, created_at")
      .eq("agent_id", agentId as any)
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseServer
      .from("crm_tasks")
      .select("id, title, status, priority, due_at, lead_id")
      .eq("agent_id", agentId as any)
      .in("status", ["pending", "in_progress"])
      .order("due_at", { ascending: true })
      .limit(15),
    supabaseServer
      .from("lead_calendar_events")
      .select("id, title, start_at, end_at, lead_id, status")
      .eq("agent_id", agentId as any)
      .eq("status", "scheduled")
      .gte("start_at", new Date().toISOString())
      .order("start_at", { ascending: true })
      .limit(10),
  ]);

  return {
    leads: leadsRes.data ?? [],
    tasks: tasksRes.data ?? [],
    upcoming_events: eventsRes.data ?? [],
  };
}

const SYSTEM_PROMPT = `You are a helpful AI assistant for a real estate agent using LeadSmart AI CRM.
You have access to the agent's current leads, tasks, and upcoming appointments.
Help them prioritize their day, suggest follow-ups, identify hot leads, and answer questions about their pipeline.
Be concise and actionable. Use the lead data provided to give specific, personalized advice.
When suggesting actions, be specific about which lead and what to do.
Format responses with short paragraphs and bullet points when listing multiple items.`;

export async function POST(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const body = await req.json();
    const { message, history } = body;

    if (!message?.trim()) {
      return NextResponse.json({ ok: false, error: "Message required" }, { status: 400 });
    }

    const openai = getOpenAI();
    if (!openai) {
      return NextResponse.json(
        { ok: false, error: "AI assistant not configured (OPENAI_API_KEY missing)" },
        { status: 503 }
      );
    }

    const context = await getAgentContext(agentId);

    const contextBlock = `
## Agent's Current Pipeline (${new Date().toLocaleDateString()})

### Leads (${context.leads.length} most recent):
${context.leads.map((l: any) => `- ${l.name || "Unknown"} | ${l.rating || "—"} | ${l.lead_status || "—"} | Score: ${l.engagement_score ?? 0} | Last contact: ${l.last_contacted_at ? new Date(l.last_contacted_at).toLocaleDateString() : "never"} | ${l.property_address || "no address"}`).join("\n")}

### Open Tasks (${context.tasks.length}):
${context.tasks.map((t: any) => `- [${t.priority || "normal"}] ${t.title} | Due: ${t.due_at ? new Date(t.due_at).toLocaleDateString() : "no date"} | Status: ${t.status}`).join("\n") || "No open tasks."}

### Upcoming Appointments (${context.upcoming_events.length}):
${context.upcoming_events.map((e: any) => `- ${e.title} | ${new Date(e.start_at).toLocaleString()}`).join("\n") || "No upcoming appointments."}
`;

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: contextBlock },
    ];

    // Add conversation history (last 10 messages)
    if (Array.isArray(history)) {
      for (const h of history.slice(-10)) {
        if (h.role === "user" || h.role === "assistant") {
          messages.push({ role: h.role, content: String(h.content) });
        }
      }
    }

    messages.push({ role: "user", content: message });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
      messages,
      max_tokens: 800,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content?.trim() || "I couldn't generate a response. Please try again.";

    return NextResponse.json({ ok: true, reply });
  } catch (e: any) {
    console.error("ai-chat error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "AI error" }, { status: 500 });
  }
}
