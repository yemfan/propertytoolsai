import Link from "next/link";
import type { ReactNode } from "react";

const primary =
  "inline-flex items-center justify-center rounded-2xl bg-[#0072ce] px-5 py-3 text-sm font-semibold !text-white shadow-md shadow-blue-900/15 transition hover:bg-[#005ca8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0072ce]";
const secondary =
  "inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400";
const ghost =
  "inline-flex items-center justify-center rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold !text-white backdrop-blur transition hover:bg-white/15";

type ButtonProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  onClick?: () => void;
  "aria-label"?: string;
};

export function LandingButton({ href, children, variant = "primary", className = "", onClick, ...rest }: ButtonProps) {
  const cls =
    variant === "primary" ? primary : variant === "secondary" ? secondary : ghost;
  return (
    <Link href={href} className={`${cls} ${className}`.trim()} onClick={onClick} {...rest}>
      {children}
    </Link>
  );
}

export function LandingCard({
  children,
  className = "",
  hover = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ${
        hover ? "transition hover:border-[#0072ce]/25 hover:shadow-md" : ""
      } ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export function LandingSectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
      {children}
    </p>
  );
}
