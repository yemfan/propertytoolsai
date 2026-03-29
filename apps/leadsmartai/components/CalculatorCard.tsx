import Link from "next/link";

interface Props {
  title: string;
  description: string;
  link: string;
}

export default function CalculatorCard({ title, description, link }: Props) {
  return (
    <Link
      href={link}
      className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition"
    >
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </Link>
  );
}
