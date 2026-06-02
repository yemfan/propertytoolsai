interface LogoProps {
  className?: string;
  size?: number;
  /** Retained for API compatibility — the brand mark is a fixed-color asset
   *  that reads on both light and dark backgrounds, so variant is a no-op. */
  variant?: "color" | "white" | "auto";
}

/**
 * HelmSmart brand mark — the blue-steel "H" in a tubular ring (brand kit v1).
 * One asset that reads on both light and dark backgrounds.
 */
export function HelmLogo({ className, size = 32 }: LogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/helmsmart-mark.png"
      alt="HelmSmart"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "contain" }}
    />
  );
}

/** Full lockup: mark + "HelmSmart.ai" wordmark (".ai" in brand blue). */
export function HelmSmartWordmark({ className, size = 32, variant = "color" }: LogoProps) {
  const textColor = variant === "white" ? "text-white" : "text-slate-900";
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <HelmLogo size={size} />
      <span className={`font-semibold tracking-tight ${textColor}`} style={{ fontSize: size * 0.5 }}>
        HelmSmart<span style={{ color: "#1E88E5" }}>.ai</span>
      </span>
    </div>
  );
}
