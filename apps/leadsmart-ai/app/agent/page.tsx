import RolePortalHub from "@/components/portals/RolePortalHub";

export default function AgentPortalPage() {
  return (
    <RolePortalHub
      eyebrow="LeadSmart AI"
      title="Agent portal"
      description="Your command center for leads, CMAs, and AI tools — jump into any workflow below."
      links={[
        { href: "/dashboard/overview", label: "Dashboard overview", description: "Today’s pipeline snapshot" },
        { href: "/dashboard/leads", label: "Leads", description: "CRM and follow-ups" },
        { href: "/smart-cma-builder", label: "Smart CMA builder", description: "Comparable analysis" },
        { href: "/dashboard/tools", label: "Tools", description: "Calculators and generators" },
        { href: "/pricing", label: "Plans & billing", description: "Upgrade when you’re ready" },
        { href: "/portal", label: "Stripe billing portal", description: "Manage subscription in Stripe" },
      ]}
    />
  );
}
