import { vi } from "vitest";

// App configuration and local-runner flags must never come from the caller's shell.
// Tests that need a value set it with vi.stubEnv after this baseline is applied.
export const TEST_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_POSTHOG_KEY", "NEXT_PUBLIC_POSTHOG_HOST",
  "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_PMLE_PASS",
  "TESTERO_LOCAL_STRIPE", "TESTERO_PROD_SCHEMA",
] as const;

export function resetTestEnvironment() {
  for (const key of TEST_ENV_KEYS) vi.stubEnv(key, undefined);
  vi.stubEnv("NODE_ENV", "test");
}
