import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "cta" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const variantClasses: Record<Variant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "bg-teal-600 text-white hover:bg-teal-700",
  cta: "bg-orange-500 text-white hover:bg-orange-600",
  ghost: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
};

export default function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}

