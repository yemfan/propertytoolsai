import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

/** Next.js 16: use ESLint CLI (see https://nextjs.org/docs/app/api-reference/config/eslint). */
export default defineConfig([
  ...nextVitals,
  {
    rules: {
      // Stricter in eslint-plugin-react-hooks v6; allow gradual cleanup.
      "react-hooks/purity": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
  ]),
]);
