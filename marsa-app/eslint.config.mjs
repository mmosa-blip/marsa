import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Force new code onto the centralized logger. `console.error` /
    // `.warn` stay allowed because even the logger falls back to them
    // under the hood, and genuine error paths should surface without
    // wrapping. Anything else should go through `@/lib/logger`.
    rules: {
      "no-console": ["warn", { allow: ["error", "warn"] }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Auto-generated Prisma client — lots of legitimate `console` usage
    // we can't edit anyway.
    "src/generated/**",
  ]),
]);

export default eslintConfig;
