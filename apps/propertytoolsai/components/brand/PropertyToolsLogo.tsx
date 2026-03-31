/**
 * Text + mark logo — no external PNG (public/images/ptlogo.png was never committed, so /images/* 404’d on Vercel).
 */
export default function PropertyToolsLogo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <svg
        className="h-[1.1em] w-[1.1em] shrink-0 text-[#0072ce]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
      <span className="brand-logo-text whitespace-nowrap leading-none tracking-tight text-[#0072ce]">
        PropertyTools<span className="text-[#ff8c42]"> AI</span>
      </span>
    </span>
  );
}
