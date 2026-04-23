import Link from "next/link";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

const actions = [
  { href: "/home-value", label: "Check Home Value" },
  { href: "/mortgage-calculator", label: "Calculate Mortgage" },
  { href: "/rental-property-analyzer", label: "Analyze Investment" },
  { href: "/market-report/los-angeles-ca", label: "Explore Market" },
];

export default function QuickActions() {
  return (
    <Section
      title="Quick Actions"
      description="What do you want to do today?"
    >
      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Button variant="ghost">{action.label}</Button>
            </Link>
          ))}
        </div>
      </Card>
    </Section>
  );
}

