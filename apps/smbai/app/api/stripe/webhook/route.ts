/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events:
 *   - checkout.session.completed → mark invoice paid + post journal entry + notify
 *
 * Configure in Stripe Dashboard:
 *   Developers → Webhooks → Add endpoint → https://your-domain/api/stripe/webhook
 *   Events: checkout.session.completed
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createNotificationService } from "@/lib/actions/notifications";
import { refreshClientLifetimeValue } from "@/lib/actions/clients";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-08-27.basil" });

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig  = request.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const invoiceId = session.metadata?.invoiceId;
    const orgId     = session.metadata?.orgId;

    if (!invoiceId || !orgId) {
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Load invoice + lines + org's default bank account
    const [{ data: inv }, { data: bankAccount }] = await Promise.all([
      supabase
        .from("invoices")
        .select(`*, invoice_lines(amount, coa_account_id)`)
        .eq("id", invoiceId)
        .single(),
      supabase
        .from("bank_accounts")
        .select("id, coa_account_id, name")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .not("coa_account_id", "is", null)
        .order("created_at")
        .limit(1)
        .single(),
    ]);

    if (!inv || inv.status === "paid") {
      return NextResponse.json({ ok: true }); // idempotent
    }

    const total = Number(inv.total);
    let journalEntryId: string | null = null;

    // Post journal entry if we have a bank account with CoA mapping
    if (bankAccount?.coa_account_id) {
      const { data: je } = await supabase
        .from("journal_entries")
        .insert({
          organization_id: orgId,
          date: new Date().toISOString().slice(0, 10),
          memo: `Invoice ${inv.invoice_number} — Stripe payment`,
          source_type: "invoice",
        })
        .select("id")
        .single();

      if (je) {
        journalEntryId = je.id;
        const lines = (Array.isArray(inv.invoice_lines) ? inv.invoice_lines : []) as {
          amount: number; coa_account_id: string | null;
        }[];

        // DR bank
        const journalLines: object[] = [
          {
            journal_entry_id: je.id,
            account_id: bankAccount.coa_account_id,
            debit: total,
            credit: 0,
            description: `Stripe — Invoice ${inv.invoice_number}`,
          },
        ];

        // CR revenue accounts (grouped)
        const byAccount = new Map<string, number>();
        for (const l of lines) {
          if (l.coa_account_id) {
            byAccount.set(l.coa_account_id, (byAccount.get(l.coa_account_id) ?? 0) + Number(l.amount));
          }
        }

        if (byAccount.size === 0) {
          // Fallback: find default revenue account
          const { data: revAcct } = await supabase
            .from("chart_of_accounts")
            .select("id")
            .eq("organization_id", orgId)
            .eq("type", "revenue")
            .order("code")
            .limit(1)
            .single();
          if (revAcct) byAccount.set(revAcct.id, total);
        }

        const creditSum = Array.from(byAccount.values()).reduce((s, v) => s + v, 0);
        const scale = creditSum > 0 ? total / creditSum : 1;
        for (const [acctId, amt] of byAccount) {
          journalLines.push({
            journal_entry_id: je.id,
            account_id: acctId,
            debit: 0,
            credit: +(amt * scale).toFixed(2),
            description: `Invoice ${inv.invoice_number}`,
          });
        }

        await supabase.from("journal_lines").insert(journalLines);
      }
    }

    // Mark invoice paid
    await supabase.from("invoices").update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent: typeof session.payment_intent === "string"
        ? session.payment_intent
        : null,
      journal_entry_id: journalEntryId,
      updated_at: new Date().toISOString(),
    }).eq("id", invoiceId);

    // Update client lifetime value
    if (inv.client_id) {
      await refreshClientLifetimeValue(inv.client_id, orgId);
    }

    // Create notification
    const { data: clientRow } = await supabase
      .from("invoices")
      .select("invoice_number, total, clients(first_name, last_name)")
      .eq("id", invoiceId)
      .single();

    const clientRaw = clientRow?.clients;
    const clientObj = (Array.isArray(clientRaw) ? clientRaw[0] : clientRaw) as {
      first_name: string | null; last_name: string | null;
    } | null;
    const clientName = clientObj
      ? [clientObj.first_name, clientObj.last_name].filter(Boolean).join(" ")
      : "a client";

    await createNotificationService(orgId, {
      type: "invoice_paid",
      title: `Payment received: $${Number(inv.total).toFixed(2)}`,
      body: `Invoice ${inv.invoice_number} paid by ${clientName} via Stripe`,
      link: `/books/invoices/${invoiceId}`,
    });
  }

  return NextResponse.json({ ok: true });
}
