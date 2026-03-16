import CalculatorCard from '../components/CalculatorCard';

const tools = [
  { name: 'Mortgage Calculator', description: 'Calculate your monthly mortgage payments', href: '/mortgage-calculator' },
  { name: 'Refinance Calculator', description: 'See if refinancing saves you money', href: '/refinance-calculator' },
  { name: 'Affordability Calculator', description: 'Know how much house you can afford', href: '/affordability-calculator' },
  { name: 'Rent vs Buy Calculator', description: 'Compare total cost of renting vs buying', href: '/rent-vs-buy-calculator' },
  { name: 'Closing Cost Estimator', description: 'Estimate closing costs for your purchase', href: '/closing-cost-estimator' },
  { name: 'Property Investment Analyzer', description: 'Analyze NOI, cash flow, and cap rate', href: '/property-investment-analyzer' },
  { name: 'Down Payment Calculator', description: 'Plan your down payment strategy', href: '/down-payment-calculator' },
  { name: 'HOA Fee Tracker', description: 'Project HOA costs over time', href: '/hoa-fee-tracker' },
  { name: 'Cash Flow Calculator', description: 'Estimate rental property cash flow', href: '/cash-flow-calculator' },
  { name: 'Cap Rate Calculator', description: 'Calculate capitalization rate from NOI', href: '/cap-rate-calculator' },
  { name: 'ROI Calculator', description: 'Estimate return on investment', href: '/roi-calculator' },
];

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-10">
      <section className="text-center mb-10">
        <h1 className="text-4xl font-bold text-blue-600 mb-4">
          AI-Powered Real Estate Tools
        </h1>
        <p className="text-gray-700 text-lg">
          Calculate, analyze, and invest with confidence.
        </p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <CalculatorCard key={tool.name} name={tool.name} description={tool.description} href={tool.href} />
        ))}
      </section>
    </div>
  );
}
