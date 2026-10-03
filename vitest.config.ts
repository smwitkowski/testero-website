import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "node_modules/**", ".next/**", "content-pipeline/**",
      "supabase/migrations_legacy/**", "e2e/**", "tests/e2e/**",
      "playwright/**", "playwright-report/**", "test-results/**",
    ],
    clearMocks: true,
    restoreMocks: true,
  },
});
