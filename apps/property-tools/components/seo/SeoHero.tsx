export function SeoHero({ h1, intro }: { h1: string; intro: string }) {
  return (
    <section className="rounded-3xl border bg-white p-8 shadow-sm md:p-10">
      <h1 className="text-3xl font-semibold tracking-tight text-gray-900 md:text-5xl">{h1}</h1>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-gray-600 md:text-base">{intro}</p>
    </section>
  );
}
