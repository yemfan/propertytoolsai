import CalculatorCard from "../components/CalculatorCard";

const calculators = [
  {
    title: "Mortgage Calculator",
    description: "Calculate monthly mortgage payments for your home.",
    link: "/mortgage-calculator",
  },
  {
    title: "Refinance Calculator",
    description: "Estimate savings when refinancing your mortgage.",
    link: "/refinance-calculator",
  },
  {
    title: "Affordability Calculator",
    description: "Find out how much home you can afford.",
    link: "/affordability-calculator",
  },
  {
    title: "Rent vs Buy Calculator",
    description: "Compare the cost of renting vs buying a home.",
    link: "/rent-vs-buy-calculator",
  },
  {
    title: "Closing Cost Estimator",
    description: "Estimate closing costs when purchasing property.",
    link: "/closing-cost-estimator",
  },
  {
    title: "Property Investment Analyzer",
    description: "Analyze rental property investment returns.",
    link: "/property-investment-analyzer",
  },
  {
    title: "Down Payment Calculator",
    description: "Calculate required down payment for your home purchase.",
    link: "/down-payment-calculator",
  },
  {
    title: "HOA Fee Tracker",
    description: "Track monthly HOA costs and total ownership expenses.",
    link: "/hoa-fee-tracker",
  },
  {
    title: "Cash Flow Calculator",
    description: "Calculate rental property monthly cash flow.",
    link: "/cash-flow-calculator",
  },
  {
    title: "Cap Rate & ROI Calculator",
    description: "Estimate cap rate and return on investment.",
    link: "/cap-rate-roi-calculator",
  },
];

export default function HomePage() {
  return (
    <div className="p-6">
      
      <h1 className="text-3xl font-bold mb-2">
        AI Property Tools
      </h1>

      <p className="text-gray-600 mb-8">
        Professional real estate calculators for buyers, investors, and agents.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {calculators.map((calc) => (
          <CalculatorCard
            key={calc.title}
            title={calc.title}
            description={calc.description}
            link={calc.link}
          />
        ))}
      </div>

    </div>
  );
}
