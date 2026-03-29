/**
 * Legacy reference — Tailwind v4 theme is defined in `app/globals.css` (`@theme` + utilities).
 * Kept for editors/tools that read this file; PostCSS does not require it for builds.
 */
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ["var(--font-heading)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          primary: "#0072CE",
          success: "#28A745",
          accent: "#FF8C42",
          surface: "#F5F5F5",
          text: "#333333",
        },
      },
    },
  },
  plugins: [],
};

export default config;

