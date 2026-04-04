import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type MouseEventHandler } from "react";
import { cn } from "@/lib/utils";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm";
  href?: string;
};

const variantClass: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default:
    "bg-blue-600 !text-white shadow hover:bg-blue-700 focus-visible:ring-[#0072ce]",
  outline:
    "border border-slate-200/90 bg-white !text-slate-900 shadow-sm ring-1 ring-slate-900/[0.03] hover:border-slate-300 hover:bg-slate-50",
  secondary: "bg-white !text-gray-900 shadow-sm hover:bg-gray-100",
};

const sizeClass: Record<NonNullable<ButtonProps["size"]>, string> = {
  default: "h-10 px-4 py-2",
  sm: "h-9 rounded-md px-3 text-xs",
};

const baseClass =
  "inline-flex items-center justify-center rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "default", size = "default", href, type = "button", onClick, ...props },
  ref
) {
  const classes = cn(baseClass, variantClass[variant], sizeClass[size], className);

  if (href) {
    return (
      <Link href={href} className={classes} onClick={onClick as unknown as MouseEventHandler<HTMLAnchorElement> | undefined}>
        {props.children}
      </Link>
    );
  }

  return (
    <button ref={ref} type={type} className={classes} onClick={onClick} {...props} />
  );
});
