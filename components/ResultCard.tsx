// components/ResultCard.tsx
interface Props {
  title: string
  value: string
  details: string
}

export default function ResultCard({ title, value, details }: Props) {
  return (
    <div className="bg-white shadow-md rounded p-6">
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-3xl font-bold text-blue-600 mb-4">{value}</p>
      <pre className="text-gray-600 whitespace-pre-wrap">{details}</pre>
    </div>
  )
}
