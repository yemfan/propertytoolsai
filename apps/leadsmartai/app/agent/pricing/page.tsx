import AgentPricingClientPage from "./page.client";

export const metadata = {
  title: "Agent plans & billing | LeadSmart AI",
  description: "Compare Starter, Pro, and Elite LeadSmart AI Agent limits and upgrade paths.",
};

/**
 * Agent pricing page — public marketing surface AND in-product
 * upgrade page in one. The client component renders different copy
 * based on the result of /api/agent/access-check:
 *   - Logged-out / no entitlement → "Choose a plan to get started"
 *   - Logged-in agent → current plan badge + upgrade options
 *
 * Was previously a redirect to /dashboard/billing, but that meant
 * marketing CTAs from the public site couldn't link here. Removed
 * the redirect so this is a real page; the proxy + agent layout
 * already allowlist /agent/pricing as a public path so logged-out
 * visitors don't bounce.
 */
export default function AgentPricingPage() {
  return <AgentPricingClientPage />;
}
