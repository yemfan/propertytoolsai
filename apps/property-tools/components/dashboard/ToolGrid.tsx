import Link from "next/link";
import Card from "@/components/ui/Card";
import Section from "@/components/ui/Section";

const tools = [
  {
    title: "Home Value Estimate",
    description: "Get an instant value range using address-level signals.",
    href: "/home-value",
  },
  {
    title: "Smart CMA Report",
    description: "Generate a polished comparative market analysis quickly.",
    href: "/smart-cma-builder",
  },
  {
    title: "Mortgage Calculator",
    description: "Estimate payment scenarios and affordability ranges.",
    href: "/mortgage-calculator",
  },
  {
    title: "Refinance Planner",
    description: "Compare new rates and break-even outcomes.",
    href: "/refinance-calculator",
  },
  {
    title: "Investment Analysis",
    description: "Evaluate cash flow, ROI, and risk profile in one place.",
    href: "/property-investment-analyzer",
  },
  {
    title: "Rent vs Buy",
    description: "Model the long-term impact of ownership vs renting.",
    href: "/rent-vs-buy-calculator",
  },
];

export default function ToolGrid() {
  return (
    <Section title="Core Tools" description="Your most-used workflows">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tools.map((tool) => (
          <Link key={tool.title} href={tool.href}>
            <Card className="h-full p-5 transition-shadow hover:shadow-md">
              <h3 className="text-base font-bold text-slate-900">{tool.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{tool.description}</p>
              <div className="mt-4 text-sm font-semibold text-blue-600">Open tool</div>
            </Card>
          </Link>
        ))}
      </div>
    </Section>
  );
}

