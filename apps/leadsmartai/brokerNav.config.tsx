import type { NavConfig } from "@repo/ui";

function navEmoji(emoji: string) {
  return (
    <span className="flex h-[1.125rem] w-[1.125rem] items-center justify-center text-base leading-none" aria-hidden>
      {emoji}
    </span>
  );
}

const brokerNavConfig = {
  id: "broker",
  sidebarTitle: "Loan broker",
  sections: [
    {
      label: "Home",
      href: "/loan-broker/dashboard",
      match: ["/loan-broker/dashboard", "/loan-broker/dashboard/overview"],
      icon: navEmoji("🏠"),
    },
    {
      label: "Pipeline",
      defaultOpen: true,
      icon: navEmoji("📋"),
      items: [
        {
          label: "Applications",
          href: "/loan-broker/dashboard/pipeline",
          match: ["/loan-broker/dashboard/pipeline"],
          icon: navEmoji("📋"),
        },
        {
          label: "Calendar",
          href: "/loan-broker/dashboard/calendar",
          match: ["/loan-broker/dashboard/calendar"],
          icon: navEmoji("📅"),
        },
      ],
    },
    {
      label: "Communicate",
      defaultOpen: true,
      icon: navEmoji("💬"),
      items: [
        {
          label: "Messages",
          href: "/loan-broker/dashboard/messages",
          match: ["/loan-broker/dashboard/messages"],
          icon: navEmoji("💬"),
        },
      ],
    },
    {
      label: "Tools",
      icon: navEmoji("🔧"),
      items: [
        {
          label: "Affordability Calc",
          href: "/affordability-calculator",
          match: [],
          icon: navEmoji("🏠"),
        },
        {
          label: "Mortgage Calc",
          href: "/mortgage-calculator",
          match: [],
          icon: navEmoji("💰"),
        },
        {
          label: "Refinance Calc",
          href: "/refinance-calculator",
          match: [],
          icon: navEmoji("📊"),
        },
      ],
    },
    {
      label: "Insights",
      icon: navEmoji("📈"),
      items: [
        {
          label: "Performance",
          href: "/loan-broker/dashboard/performance",
          match: ["/loan-broker/dashboard/performance"],
          icon: navEmoji("📈"),
        },
      ],
    },
    {
      label: "Account",
      icon: navEmoji("⚙️"),
      items: [
        {
          label: "Settings",
          href: "/loan-broker/dashboard/settings",
          match: ["/loan-broker/dashboard/settings"],
          icon: navEmoji("⚙️"),
        },
        {
          label: "Billing",
          href: "/loan-broker/pricing",
          match: ["/loan-broker/pricing"],
          icon: navEmoji("💳"),
        },
      ],
    },
  ],
} satisfies NavConfig;

export default brokerNavConfig;
