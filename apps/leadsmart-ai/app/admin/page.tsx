import RolePortalHub from "@/components/portals/RolePortalHub";

export default function AdminPortalPage() {
  return (
    <RolePortalHub
      eyebrow="LeadSmart AI"
      title="Admin portal"
      description="Platform administration and operational tools. Open the full dashboard for day-to-day work."
      links={[
        { href: "/admin/platform-overview", label: "Platform overview", description: "Cross-product KPIs, funnel, and ops" },
        { href: "/admin/billing", label: "Subscription & billing", description: "Plans, MRR, and subscription status" },
        { href: "/admin/support", label: "Support inbox", description: "Customer conversations and replies" },
        { href: "/dashboard/overview", label: "Operations dashboard", description: "Overview, leads, and tools" },
        { href: "/dashboard/settings", label: "Account & settings", description: "Profile and preferences" },
        { href: "/pricing", label: "Plans & billing", description: "Subscriptions and upgrades" },
        { href: "/portal", label: "Stripe billing portal", description: "Invoices and payment method" },
      ]}
    />
  );
}
