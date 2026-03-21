import Stripe from "stripe";

// Avoid hard-failing during `next build` when env vars are not set.
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const dummyStripeKey = "sk_test_dummy_dummy_dummy_dummy_dummy_dummy_dummy";

export const stripe = new Stripe(stripeSecretKey ?? dummyStripeKey, {
  apiVersion: "2023-10-16" as any,
});

