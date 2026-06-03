/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe events. Currently processes:
 *   - checkout.session.completed  → marks invoice paid, fires notification + automations
 *
 * Setup in Stripe Dashboard:
 *   Endpoint: https://your-domain.com/api/stripe/webhook
 *   Events:   checkout.session.completed
 *
 * Env vars:
 *   STRIPE_SECRET_KEY       — Stripe secret key
 *   STRIPE_WEBHOOK_SECRET   — Webhook signing secret (whsec_...)
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { runAutomations } from "@/lib/automation-engine";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  // Read raw body — required for Stripe signature verification
  const rawBody = await request.text();
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  const stripe = new Stripe(stripeKey);

  let event: Stripe.Event;
  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } else {
      // Dev mode — no signature check (never in production)
      event = JSON.parse(rawBody) as Stripe.Event;
    }
  } catch (err) {
    console.error("[stripe/webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ── checkout.session.completed ───────────────────────────────────────────────

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const invoiceId = session.metadata?.invoice_id;

    if (!invoiceId) {
      return NextResponse.json({ ok: true, skipped: "no_invoice_id" });
    }

    const supabase = createServiceClient();

    const { data: inv } = await supabase
      .from("invoices")
      .select("id, invoice_number, total, status, organization_id, client_id")
      .eq("id", invoiceId)
      .single();

    if (!inv) {
      return NextResponse.json({ ok: true, skipped: "not_found" });
    }

    // Idempotency guard — Stripe can fire the event more than once
    if (inv.status === "paid") {
      return NextResponse.json({ ok: true, skipped: "already_paid" });
    }

    const paymentIntent =
      typeof session.payment_intent === "string" ? session.payment_intent : null;

    // Mark paid
    await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_intent: paymentIntent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    // In-app notification
    await supabase.from("notifications").insert({
      organization_id: inv.organization_id,
      type: "invoice_paid",
      title: `Payment received: $${Number(inv.total).toFixed(2)}`,
      body: `Invoice ${inv.invoice_number} paid via Stripe`,
      link: `/books/invoices/${invoiceId}`,
    });

    // Update client lifetime value
    if (inv.client_id) {
      const { data: paidInvoices } = await supabase
        .from("invoices")
        .select("total")
        .eq("client_id", inv.client_id)
        .eq("organization_id", inv.organization_id)
        .eq("status", "paid");

      const lifetime = (paidInvoices ?? []).reduce(
        (s, i) => s + Number(i.total),
        0
      );

      await supabase
        .from("clients")
        .update({ lifetime_value: lifetime })
        .eq("id", inv.client_id)
        .eq("organization_id", inv.organization_id);
    }

    // Fire automation rules
    await runAutomations("invoice_paid", {
      orgId: inv.organization_id,
      clientId: inv.client_id ?? null,
      invoiceId,
      invoiceNumber: inv.invoice_number,
      amount: Number(inv.total),
    });
  }

  return NextResponse.json({ ok: true });
}
