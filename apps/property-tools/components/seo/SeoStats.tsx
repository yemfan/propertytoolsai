export function SeoStats({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">{item.label}</div>
          <div className="mt-2 text-xl font-semibold text-gray-900">{item.value}</div>
        </div>
      ))}
    </section>
  );
}
