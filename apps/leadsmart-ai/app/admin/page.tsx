import RolePortalHub from "@/components/portals/RolePortalHub";

export default function AdminPortalPage() {
  return (
    <RolePortalHub
      eyebrow="LeadSmart AI"
      title="Admin portal"
      description="Platform administration and operational tools. Open the full dashboard for day-to-day work."
      links={[
        { href: "/dashboard/overview", label: "Operations dashboard", description: "Overview, leads, and tools" },
        { href: "/dashboard/settings", label: "Account & settings", description: "Profile and preferences" },
        { href: "/pricing", label: "Plans & billing", description: "Subscriptions and upgrades" },
        { href: "/portal", label: "Stripe billing portal", description: "Invoices and payment method" },
      ]}
    />
  );
}
