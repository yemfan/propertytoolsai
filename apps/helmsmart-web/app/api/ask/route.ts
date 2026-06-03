/**
 * POST /api/ask
 *
 * Streaming AI business assistant. Injects live business data from Supabase
 * into the system prompt, then streams a Claude response back as plain text.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

type Message = { role: "user" | "assistant"; content: string };

// ─── Business context builder ──────────────────────────────────────────────────

async function buildContext(orgId: string): Promise<string> {
  const supabase = await createClient();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const [orgRes, clientsRes, invoicesRes, txnsRes] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", orgId).single(),
    supabase.from("clients").select("status").eq("organization_id", orgId),
    supabase
      .from("invoices")
      .select("status, total, due_date")
      .eq("organization_id", orgId)
      .neq("status", "void"),
    supabase
      .from("bank_transactions")
      .select("amount, personal_finance_category")
      .eq("organization_id", orgId)
      .eq("pending", false)
      .gte("date", monthStart)
      .lte("date", todayStr),
  ]);

  const orgName = orgRes.data?.name ?? "your business";
  const clients = clientsRes.data ?? [];
  const invoices = invoicesRes.data ?? [];
  const txns = txnsRes.data ?? [];

  // Summarise clients by status
  const clientCounts = clients.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  // Summarise invoices
  const outstanding = invoices.filter(
    (i) => i.status === "sent" || i.status === "overdue"
  );
  const overdue = invoices.filter(
    (i) =>
      i.status === "overdue" ||
      (i.status === "sent" && i.due_date < todayStr)
  );
  const paid = invoices.filter((i) => i.status === "paid");
  const totalOutstanding = outstanding.reduce((s, i) => s + Number(i.total), 0);
  const totalPaid = paid.reduce((s, i) => s + Number(i.total), 0);

  // Summarise bank transactions (MTD)
  let mtdRevenue = 0;
  let mtdExpenses = 0;
  const catMap = new Map<string, number>();
  for (const t of txns) {
    // Plaid sign convention: negative = inflow (revenue), positive = outflow (expense)
    if (t.amount < 0) {
      mtdRevenue += Math.abs(t.amount);
    } else {
      mtdExpenses += t.amount;
      const cat = t.personal_finance_category ?? "Uncategorized";
      catMap.set(cat, (catMap.get(cat) ?? 0) + t.amount);
    }
  }
  const topCats = Array.from(catMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([cat, amt]) => `  • ${cat.replace(/_/g, " ").toLowerCase()}: $${amt.toFixed(2)}`)
    .join("\n");

  return `Organization: ${orgName}
Today: ${todayStr} | Month-to-date: ${monthStart} to ${todayStr}

CLIENTS (${clients.length} total)
  Active: ${clientCounts["active"] ?? 0}  |  Leads: ${clientCounts["lead"] ?? 0}  |  Prospects: ${clientCounts["prospect"] ?? 0}  |  Inactive: ${clientCounts["inactive"] ?? 0}

INVOICES
  Outstanding (unpaid): ${outstanding.length} invoices · $${totalOutstanding.toFixed(2)}
  Overdue:              ${overdue.length} invoices
  Paid (all-time):      ${paid.length} invoices · $${totalPaid.toFixed(2)}

BANK TRANSACTIONS (month-to-date)
  Revenue:  $${mtdRevenue.toFixed(2)}
  Expenses: $${mtdExpenses.toFixed(2)}
  Net:      $${(mtdRevenue - mtdExpenses).toFixed(2)}
${topCats ? `\n  Top expense categories:\n${topCats}` : ""}`;
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value ?? "";
  if (!orgId) return new NextResponse("Unauthorized", { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new NextResponse("AI not configured — set ANTHROPIC_API_KEY", { status: 503 });
  }

  let messages: Message[] = [];
  try {
    const body = await request.json();
    messages = (body.messages ?? []) as Message[];
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }
  if (!messages.length) return new NextResponse("No messages provided", { status: 400 });

  const context = await buildContext(orgId);
  const anthropic = new Anthropic({ apiKey });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = anthropic.messages.stream({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 1024,
          system: `You are an AI business assistant with access to real-time data from the user's business. Answer concisely and specifically. Format currency as USD. Use bullet points for lists. Today's live business snapshot:\n\n${context}`,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });

        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "An unexpected error occurred";
        controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache",
    },
  });
}
