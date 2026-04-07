import { redirect } from "next/navigation";

export const metadata = {
  title: "Agent plans & billing | LeadSmart AI",
  description: "Compare Starter, Pro, and Elite LeadSmart AI Agent limits and upgrade paths.",
};

export default async function AgentPricingPage() {
  redirect("/dashboard/billing");
}
