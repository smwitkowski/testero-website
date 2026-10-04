import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([
    ".next/**", "out/**", "build/**", "next-env.d.ts",
    "content-pipeline/**", "supabase/migrations_legacy/**",
    "playwright-report/**", "test-results/**",
  ]),
]);
