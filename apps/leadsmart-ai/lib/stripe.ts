import Stripe from "stripe";

// Avoid hard-failing during `next build` when env vars are not set.
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const dummyStripeKey = "sk_test_dummy_dummy_dummy_dummy_dummy_dummy_dummy";

/** Keep in sync with `stripe` package `LatestApiVersion` (see `node_modules/stripe/types/lib.d.ts`). */
const STRIPE_API_VERSION: Stripe.LatestApiVersion = "2025-08-27.basil";

/**
 * Stripe client for server routes and webhooks.
 * Mismatched/old API versions can cause odd Hosted Checkout failures (e.g. session confirm errors).
 *
 * @see https://docs.stripe.com/api/versioning
 */
export const stripe = new Stripe(stripeSecretKey ?? dummyStripeKey, {
  apiVersion: STRIPE_API_VERSION,
});
