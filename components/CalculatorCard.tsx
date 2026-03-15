import Link from "next/link";

interface Props {
  name: string;
  description: string;
  href: string;
}

export default function CalculatorCard({ name, description, href }: Props) {
  return (
    <div className="bg-white shadow-md rounded p-6 hover:shadow-lg transition">
      <h2 className="text-xl font-semibold mb-2">{name}</h2>
      <p className="text-gray-600 mb-4">{description}</p>
      <Link href={href} className="text-blue-600 hover:underline font-medium">
        Try Now
      </Link>
    </div>
  );
}
