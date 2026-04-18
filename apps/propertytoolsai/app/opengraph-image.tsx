import { ImageResponse } from "next/og";

/**
 * Root `og:image` for PropertyTools AI — auto-detected by Next.js App Router.
 * Rendered on demand as a 1200×630 PNG from this JSX tree (see Vercel OG).
 *
 * Why this file exists: before it was added, `app/layout.tsx` metadata
 * referenced `/images/og-default.png` which never existed on disk, so every
 * social share (LinkedIn, Twitter/X, iMessage, Facebook, Slack) showed a
 * broken preview. This file replaces the static asset with a dynamically
 * generated image that stays in sync with the brand colors, never 404s,
 * and requires zero manual design work.
 */

export const runtime = "edge";
export const alt = "PropertyTools AI — Free AI Real Estate Tools";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * CSS-drawn checkmark. We can't use a ✓ glyph (U+2713) because
 * @vercel/og tries to fetch a dynamic Google Fonts subset for any char
 * outside its base font, and that fetch intermittently returns 400 —
 * which caused every social-share image render to log a font error.
 * A rotated L-shape built from two borders is always renderable and
 * requires zero font resolution.
 */
function Check() {
  return (
    <div
      style={{
        display: "flex",
        width: "22px",
        height: "22px",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          width: "14px",
          height: "8px",
          borderLeft: "3px solid #10b981",
          borderBottom: "3px solid #10b981",
          transform: "rotate(-45deg) translate(2px, -2px)",
        }}
      />
    </div>
  );
}

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 40%, #e0f2fe 100%)",
          fontFamily: "system-ui, -apple-system, Helvetica, Arial, sans-serif",
        }}
      >
        {/* Subtle radial accent */}
        <div
          style={{
            position: "absolute",
            top: "-120px",
            right: "-120px",
            width: "520px",
            height: "520px",
            background: "radial-gradient(circle, rgba(0,114,206,0.18) 0%, rgba(0,114,206,0) 70%)",
            borderRadius: "9999px",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-160px",
            left: "-100px",
            width: "460px",
            height: "460px",
            background: "radial-gradient(circle, rgba(79,70,229,0.12) 0%, rgba(79,70,229,0) 70%)",
            borderRadius: "9999px",
            display: "flex",
          }}
        />

        {/* Content column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "72px 80px",
            height: "100%",
            position: "relative",
          }}
        >
          {/* Top: brand */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              fontSize: "28px",
              fontWeight: 700,
              color: "#0f172a",
              letterSpacing: "-0.02em",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "52px",
                height: "52px",
                background: "#0072ce",
                borderRadius: "14px",
                color: "#ffffff",
                fontSize: "22px",
                fontWeight: 800,
                letterSpacing: "-0.02em",
              }}
            >
              PT
            </div>
            PropertyTools AI
          </div>

          {/* Middle: headline */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: "auto",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: "78px",
                fontWeight: 800,
                lineHeight: 1.02,
                letterSpacing: "-0.03em",
                color: "#0f172a",
                maxWidth: "960px",
              }}
            >
              Know What a Home
            </div>
            <div
              style={{
                display: "flex",
                fontSize: "78px",
                fontWeight: 800,
                lineHeight: 1.02,
                letterSpacing: "-0.03em",
                background: "linear-gradient(90deg, #0072ce 0%, #005ca8 100%)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Is Worth — Instantly.
            </div>
          </div>

          {/* Bottom: subhead + feature row */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div
              style={{
                display: "flex",
                fontSize: "26px",
                color: "#475569",
                lineHeight: 1.4,
                maxWidth: "920px",
              }}
            >
              Free AI-powered home value, mortgage, affordability, and comparison tools.
            </div>
            <div style={{ display: "flex", gap: "28px", fontSize: "20px", color: "#0f172a", fontWeight: 500 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Check />
                No sign-up
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Check />
                Instant results
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Check />
                Free forever
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
