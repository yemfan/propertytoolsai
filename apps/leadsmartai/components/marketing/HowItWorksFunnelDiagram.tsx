/**
 * Large SVG conversion funnel for the “How it works” section.
 * Three narrowing stages + outcome — high visual impact on desktop and mobile.
 */
type Props = {
  /** Short line above the diagram */
  caption?: string;
  /** Top → bottom stage titles (matches your Attract → Capture → Close narrative) */
  stages: [string, string, string];
  /** Optional micro-line under each stage title (same order) */
  hints?: [string, string, string];
  /** Outcome label below the funnel */
  outcome: string;
};

export default function HowItWorksFunnelDiagram({ caption, stages, hints, outcome }: Props) {
  const [top, mid, bot] = stages;
  const [h1, h2, h3] = hints ?? ["", "", ""];
  const uid = "ls-funnel";

  return (
    <div className="relative mx-auto w-full max-w-5xl px-0 sm:px-2">
      {caption ? (
        <p className="mb-5 text-center text-xs font-bold uppercase tracking-[0.22em] text-amber-900/75 sm:text-sm">
          {caption}
        </p>
      ) : null}

      <figure className="relative mx-auto">
        <div className="overflow-hidden rounded-3xl border border-amber-200/90 bg-gradient-to-b from-white via-amber-50/40 to-amber-50/20 p-3 shadow-[0_28px_90px_-24px_rgba(245,158,11,0.45)] sm:p-6 md:p-10">
          <svg
            viewBox="0 0 800 480"
            className="mx-auto h-auto w-full max-w-[52rem]"
            role="img"
            aria-labelledby="funnel-title"
          >
            <title id="funnel-title">Conversion funnel from traffic to outcome</title>
            <defs>
              <linearGradient id={`${uid}-1`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fef3c7" />
                <stop offset="100%" stopColor="#fde68a" />
              </linearGradient>
              <linearGradient id={`${uid}-2`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fcd34d" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
              <linearGradient id={`${uid}-3`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0072ce" />
              </linearGradient>
              <filter id={`${uid}-sh`} x="-12%" y="-12%" width="124%" height="124%">
                <feDropShadow dx="0" dy="6" stdDeviation="5" floodOpacity="0.14" />
              </filter>
            </defs>

            <path
              d="M 40 20 L 760 20 L 684 152 L 116 152 Z"
              fill={`url(#${uid}-1)`}
              stroke="#f59e0b"
              strokeWidth="1.5"
              filter={`url(#${uid}-sh)`}
            />
            <path
              d="M 116 160 L 684 160 L 612 300 L 188 300 Z"
              fill={`url(#${uid}-2)`}
              stroke="#d97706"
              strokeWidth="1.5"
              filter={`url(#${uid}-sh)`}
            />
            <path
              d="M 188 308 L 612 308 L 532 404 L 268 404 Z"
              fill={`url(#${uid}-3)`}
              stroke="#0369a1"
              strokeWidth="1.5"
              filter={`url(#${uid}-sh)`}
            />
            <path d="M 268 412 L 532 412 L 452 458 L 348 458 Z" fill="#005ca8" stroke="#004a87" strokeWidth="1.5" />

            <text x="400" y="92" textAnchor="middle" fill="#0f172a" fontSize="21" fontWeight="700" fontFamily="system-ui, sans-serif">
              {top}
            </text>
            {h1 ? (
              <text x="400" y="118" textAnchor="middle" fill="#334155" fontSize="13" fontWeight="600" fontFamily="system-ui, sans-serif">
                {h1}
              </text>
            ) : null}

            <text x="400" y="242" textAnchor="middle" fill="#0f172a" fontSize="21" fontWeight="700" fontFamily="system-ui, sans-serif">
              {mid}
            </text>
            {h2 ? (
              <text x="400" y="268" textAnchor="middle" fill="#1e293b" fontSize="13" fontWeight="600" fontFamily="system-ui, sans-serif">
                {h2}
              </text>
            ) : null}

            <text x="400" y="364" textAnchor="middle" fill="#ffffff" fontSize="21" fontWeight="700" fontFamily="system-ui, sans-serif">
              {bot}
            </text>
            {h3 ? (
              <text x="400" y="390" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="600" fontFamily="system-ui, sans-serif" opacity={0.92}>
                {h3}
              </text>
            ) : null}
          </svg>

          {/* Outcome — sits just under the funnel graphic */}
          <div className="-mt-2 flex justify-center px-2 pb-1 sm:-mt-3 sm:px-4">
            <div className="w-full max-w-md rounded-2xl border-2 border-emerald-400/95 bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4 text-center shadow-[0_18px_40px_-12px_rgba(5,150,105,0.55)] ring-2 ring-white/25">
              <p className="font-heading text-lg font-bold tracking-tight text-white sm:text-xl md:text-2xl">{outcome}</p>
            </div>
          </div>
        </div>

        <figcaption className="sr-only">
          Funnel: {top}, then {mid}, then {bot}. Final outcome: {outcome}.
        </figcaption>
      </figure>
    </div>
  );
}
