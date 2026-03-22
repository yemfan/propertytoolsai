import * as React from "react";
import type { ButtonHTMLAttributes } from "react";
import Link from "next/link";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?:
    | "default"
    | "outline"
    | "secondary"
    | "ghost"
    | "destructive"
    | "link"
    /** White text + border for dark backgrounds (hero bars, slate/gray-900 sections). */
    | "inverse";
  size?: "default" | "sm" | "lg" | "icon";
  /** When set, renders a Next.js `Link` with the same styles (better for navigation + SEO). */
  href?: string;
};

function buttonClasses(
  variant: NonNullable<ButtonProps["variant"]> = "default",
  size: NonNullable<ButtonProps["size"]> = "default",
  className = ""
) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
    default: "bg-[#0072ce] text-white shadow-sm hover:bg-[#005ca8] focus-visible:ring-[#0072ce]",
    outline: "border-2 border-slate-200 bg-white text-slate-900 hover:bg-slate-50 focus-visible:ring-[#0072ce]",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200 focus-visible:ring-[#0072ce]",
    ghost: "text-slate-900 hover:bg-slate-100 focus-visible:ring-[#0072ce]",
    destructive: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500",
    link: "text-[#0072ce] underline-offset-4 hover:underline shadow-none focus-visible:ring-[#0072ce]",
    inverse:
      "border-2 border-white/90 bg-transparent text-white shadow-none hover:bg-white/15 hover:text-white focus-visible:ring-white/70 focus-visible:ring-offset-gray-900",
  };
  const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
    default: "h-10 px-4 py-2 text-sm",
    sm: "h-9 rounded-lg px-3 text-xs",
    lg: "h-11 rounded-xl px-8 text-base",
    icon: "h-10 w-10 p-0",
  };
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`.trim();
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", size = "default", href, type = "button", onClick, ...props }, ref) => {
    const cls = buttonClasses(variant, size, className);

    if (href) {
      return (
        <Link
          href={href}
          className={cls}
          onClick={onClick as unknown as React.MouseEventHandler<HTMLAnchorElement> | undefined}
        >
          {props.children}
        </Link>
      );
    }

    return <button ref={ref} type={type} className={cls} onClick={onClick} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonClasses };

/** Legacy default export — used by tool pages (`import Button from "@/components/ui/Button"`). */
type LegacyVariant = "primary" | "secondary" | "cta" | "ghost";

const legacyVariantClasses: Record<LegacyVariant, string> = {
  primary: "bg-[#2563eb] text-white shadow-sm hover:bg-[#1d4ed8]",
  secondary: "bg-[#0d9488] text-white shadow-sm hover:bg-[#0f766e]",
  cta: "bg-[#f97316] text-white shadow-sm hover:bg-[#ea580c]",
  ghost: "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
};

type LegacyButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: LegacyVariant };

export default function LegacyButton({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: LegacyButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${legacyVariantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
