import RolePortalHub from "@/components/portals/RolePortalHub";

export default function BrokerPortalPage() {
  return (
    <RolePortalHub
      eyebrow="LeadSmart AI"
      title="Broker portal"
      description="Lead your brokerage with pipeline visibility, growth tools, and team-ready workflows."
      links={[
        { href: "/dashboard/overview", label: "Broker dashboard", description: "Overview and KPIs" },
        { href: "/dashboard/growth", label: "Growth & SEO", description: "Traffic and landing tools" },
        { href: "/dashboard/leads", label: "Leads & CRM", description: "Pipeline and follow-ups" },
        { href: "/dashboard/marketing", label: "Marketing", description: "Campaigns and assets" },
        { href: "/pricing", label: "Plans & billing", description: "Team plans and upgrades" },
        { href: "/portal", label: "Stripe billing portal", description: "Billing and invoices" },
      ]}
    />
  );
}
