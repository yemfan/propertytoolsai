/**
 * Verifies Stripe **test mode** accepts card 4242424242424242 and returns a succeeded PaymentIntent.
 *
 * Uses: any CVC (e.g. 123), any future exp (e.g. 12/2034), any ZIP.
 *
 * Usage:
 *   npm run smoke:stripe-test-card -w leadsmart-ai
 *
 * Env: STRIPE_SECRET_KEY=sk_test_... in apps/leadsmart-ai/.env.local
 */

import Stripe from "stripe";
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

async function main() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    console.error("Missing STRIPE_SECRET_KEY (set in apps/leadsmart-ai/.env.local)");
    process.exitCode = 1;
    return;
  }
  if (!key.startsWith("sk_test")) {
    console.error("Refusing to run: STRIPE_SECRET_KEY must be a test secret (sk_test_...).");
    process.exitCode = 1;
    return;
  }

  const stripe = new Stripe(key, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pinned in lib/stripe.ts
    apiVersion: "2025-02-24.acacia" as any,
  });

  console.log("Creating PaymentMethod with test Visa 4242424242424242…\n");

  let pmId: string;
  try {
    const pm = await stripe.paymentMethods.create({
      type: "card",
      card: {
        number: "4242424242424242",
        exp_month: 12,
        exp_year: 2034,
        cvc: "123",
      },
    });
    pmId = pm.id;
    console.log(`✓ PaymentMethod created: ${pmId}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("✗ Could not create PaymentMethod with raw card (some accounts restrict this):", msg);
    console.log("Retrying with Stripe test token pm_card_visa…\n");
    pmId = "pm_card_visa";
  }

  const pi = await stripe.paymentIntents.create({
    amount: 2000,
    currency: "usd",
    payment_method: pmId,
    confirm: true,
    payment_method_types: ["card"],
    description: "smoke:stripe-test-card-success",
  });

  console.log("\nPaymentIntent result:");
  console.log(JSON.stringify(
    {
      id: pi.id,
      status: pi.status,
      amount: pi.amount,
      currency: pi.currency,
      charges: pi.charges?.data?.map((c) => ({ id: c.id, paid: c.paid, status: c.status })),
    },
    null,
    2
  ));

  if (pi.status === "succeeded") {
    console.log("\n✓ Test card flow returned payment success (status=succeeded).\n");
    return;
  }

  if (pi.status === "requires_action") {
    console.error(
      "\n✗ Unexpected requires_action for 4242 — normally no 3DS. Check Stripe account settings.\n"
    );
    process.exitCode = 1;
    return;
  }

  console.error(`\n✗ Expected status succeeded, got: ${pi.status}\n`);
  process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
