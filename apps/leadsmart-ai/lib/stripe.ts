import Stripe from "stripe";

// Avoid hard-failing during `next build` when env vars are not set.
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const dummyStripeKey = "sk_test_dummy_dummy_dummy_dummy_dummy_dummy_dummy";

/**
 * Stripe client for server routes and webhooks.
 * `apiVersion` pins your Stripe API version; types in `stripe` may lag — use `as const` / assertion when needed.
 *
 * @see https://docs.stripe.com/api/versioning
 */
export const stripe = new Stripe(stripeSecretKey ?? dummyStripeKey, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Stripe types only ship LatestApiVersion; acacia is valid at runtime.
  apiVersion: "2025-02-24.acacia" as any,
});
