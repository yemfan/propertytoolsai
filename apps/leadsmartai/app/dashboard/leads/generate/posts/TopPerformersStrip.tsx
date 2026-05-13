import type { TopPostItem } from "@/lib/leads-gen/top-posts";

/**
 * "Top performers" strip on the web Posts page. Server-rendered;
 * renders up to 3 cards side-by-side at the top of the list with
 * the agent's highest-engagement posts (last 14 days). Each card
 * is a link to the live post on Meta — the History list below
 * holds the full per-row controls.
 *
 * The strip auto-hides upstream (`top.hasMetrics`) so brand-new
 * agents don't see an empty section.
 */
export default function TopPerformersStrip({
  items,
  windowDays,
}: {
  items: TopPostItem[];
  windowDays: number;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 flex items-baseline gap-2 text-sm font-semibold text-gray-700">
        Top performers
        <span className="text-xs font-normal text-gray-500">
          · last {windowDays} days
        </span>
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, idx) => (
          <Card key={item.id} item={item} rank={idx + 1} />
        ))}
      </div>
    </section>
  );
}

function Card({ item, rank }: { item: TopPostItem; rank: number }) {
  const platformLabel =
    item.platform === "facebook"
      ? "Facebook"
      : item.platform === "instagram"
        ? "Instagram"
        : item.platform === "linkedin"
          ? "LinkedIn"
          : item.platform;
  const platformAccent =
    item.platform === "facebook"
      ? "bg-blue-100 text-blue-700"
      : item.platform === "instagram"
        ? "bg-pink-100 text-pink-700"
        : "bg-sky-100 text-sky-700";
  const accountName =
    item.pageName ??
    item.igBusinessUsername ??
    item.linkedinDisplayName ??
    "—";
  const publishedAt = item.publishedAt ? new Date(item.publishedAt) : null;

  const cells: Array<{ label: string; value: number | null }> = [
    { label: "Likes", value: item.metrics.likes },
    { label: "Comments", value: item.metrics.comments },
    { label: "Shares", value: item.metrics.shares },
    { label: "Saves", value: item.metrics.saves },
  ];
  const ranked = cells
    .filter((c) => (c.value ?? 0) > 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .slice(0, 3);

  const Inner = (
    <article className="group relative h-full overflow-hidden rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:border-blue-200 hover:shadow-md">
      <div className="flex gap-3">
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl}
            alt=""
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg font-bold text-gray-400">
            #{rank}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${platformAccent}`}
            >
              {platformLabel}
            </span>
            <span className="truncate text-gray-600">{accountName}</span>
          </div>
          <p className="line-clamp-2 text-sm text-gray-800">{item.caption}</p>
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-gray-900">
          {item.engagementScore.toLocaleString()}
        </span>
        <span className="text-xs font-medium text-gray-500">
          total engagement
        </span>
      </div>

      {ranked.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
          {ranked.map((c) => (
            <span key={c.label}>
              <strong className="text-gray-700">
                {c.value!.toLocaleString()}
              </strong>{" "}
              {c.label.toLowerCase()}
            </span>
          ))}
        </div>
      )}

      {publishedAt && (
        <p className="mt-2 text-[11px] text-gray-400">
          {publishedAt.toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      )}
    </article>
  );

  if (item.externalPostUrl) {
    return (
      <a
        href={item.externalPostUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-xl"
      >
        {Inner}
      </a>
    );
  }
  return Inner;
}
