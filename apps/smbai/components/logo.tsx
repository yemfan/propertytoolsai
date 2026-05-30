interface LogoProps {
  className?: string;
  size?: number;
  /** "color" uses indigo, "white" forces white, "auto" uses currentColor */
  variant?: "color" | "white" | "auto";
}

/**
 * HelmSmart logo mark — a clean geometric ship's helm wheel.
 * 6 evenly-spaced spokes, outer ring, centre hub.
 */
export function HelmLogo({ className, size = 32, variant = "color" }: LogoProps) {
  const color =
    variant === "color" ? "#4F46E5" : variant === "white" ? "#FFFFFF" : "currentColor";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="HelmSmart"
    >
      {/* Outer ring */}
      <circle cx="20" cy="20" r="17" stroke={color} strokeWidth="2.5" />
      {/* Centre hub */}
      <circle cx="20" cy="20" r="3.5" fill={color} />
      {/* 6 spokes at 60° intervals */}
      <line x1="20"   y1="15"   x2="20"   y2="5"    stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="24.3" y1="17.5" x2="33.0" y2="12.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="24.3" y1="22.5" x2="33.0" y2="27.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="20"   y1="25"   x2="20"   y2="35"   stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="15.7" y1="22.5" x2="7.0"  y2="27.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="15.7" y1="17.5" x2="7.0"  y2="12.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Full wordmark: icon + "HelmSmart" text */
export function HelmSmartWordmark({
  className,
  size = 32,
  variant = "color",
}: LogoProps) {
  const textColor =
    variant === "white" ? "text-white" : "text-slate-900";

  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <HelmLogo size={size} variant={variant} />
      <span className={`font-bold tracking-tight ${textColor}`} style={{ fontSize: size * 0.5 }}>
        Helm<span className={variant === "white" ? "opacity-80" : "text-indigo-600"}>Smart</span>
      </span>
    </div>
  );
}
