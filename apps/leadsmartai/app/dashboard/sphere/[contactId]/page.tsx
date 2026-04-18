import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { getContact } from "@/lib/contacts/service";
import { listTemplatesForAgent } from "@/lib/templates/service";
import SphereContactProfile from "@/components/dashboard/SphereContactProfile";

export const metadata: Metadata = {
  title: "Sphere contact",
  robots: { index: false },
};

export default async function SphereContactPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const { contactId } = await params;
  const { agentId } = await getCurrentAgentContext();
  const [contact, templates] = await Promise.all([
    getContact(agentId, contactId),
    listTemplatesForAgent(agentId),
  ]);
  if (!contact) notFound();
  return <SphereContactProfile contact={contact} templates={templates} />;
}
