import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "cta" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const variantClasses: Record<Variant, string> = {
  /* Hex + explicit text-white avoids white-on-white if palette utilities fail in CI */
  primary: "bg-[#2563eb] text-white shadow-sm hover:bg-[#1d4ed8]",
  secondary: "bg-[#0d9488] text-white shadow-sm hover:bg-[#0f766e]",
  cta: "bg-[#f97316] text-white shadow-sm hover:bg-[#ea580c]",
  ghost: "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
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

