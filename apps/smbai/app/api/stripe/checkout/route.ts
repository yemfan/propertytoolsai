/**
 * GET /api/stripe/checkout?invoice=<id>
 *
 * Creates a Stripe Checkout Session for the given invoice and redirects the
 * client to Stripe's hosted payment page. No session auth required — the
 * invoice ID acts as a capability token (UUID, hard to guess).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-08-27.basil" });

export async function GET(request: NextRequest) {
  const invoiceId = request.nextUrl.searchParams.get("invoice");
  if (!invoiceId) {
    return NextResponse.json({ error: "Missing invoice" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Load invoice + client
  const { data: inv } = await supabase
    .from("invoices")
    .select(`id, invoice_number, total, status, organization_id,
             clients(first_name, last_name, email)`)
    .eq("id", invoiceId)
    .single();

  if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (inv.status === "paid" || inv.status === "void") {
    // Already paid — redirect back to invoice
    return NextResponse.redirect(
      new URL(`/books/invoices/${invoiceId}`, request.url)
    );
  }

  const clientRaw = inv.clients;
  const client = (Array.isArray(clientRaw) ? clientRaw[0] : clientRaw) as {
    first_name: string | null; last_name: string | null; email: string | null;
  } | null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: client?.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: Math.round(Number(inv.total) * 100), // cents
          product_data: {
            name: `Invoice ${inv.invoice_number}`,
            description: client
              ? `Payment from ${[client.first_name, client.last_name].filter(Boolean).join(" ")}`
              : undefined,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      invoiceId: inv.id,
      orgId: inv.organization_id,
    },
    success_url: `${appUrl}/books/invoices/${inv.id}?stripe=success`,
    cancel_url: `${appUrl}/books/invoices/${inv.id}?stripe=cancelled`,
  });

  // Store session ID on invoice
  await supabase
    .from("invoices")
    .update({ stripe_session_id: session.id })
    .eq("id", inv.id);

  return NextResponse.redirect(session.url!);
}
