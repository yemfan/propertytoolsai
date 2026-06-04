import { term } from "@/lib/packs";

/**
 * A page <h1> whose text is relabeled by the active industry pack, so headings match
 * the (already pack-aware) sidebar — e.g. "Books" renders as "Billing" on DoctorSmart,
 * "Reception" as "Front Desk". On Core it's the identity. Async server component.
 */
export async function PageTitle({ base, className }: { base: string; className?: string }) {
  const label = await term(base);
  return <h1 className={className ?? "text-2xl font-semibold text-slate-900"}>{label}</h1>;
}
