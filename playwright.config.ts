import { defineConfig, devices } from "@playwright/test"

const PORT = Number(process.env.PORT ?? 3000)

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEB_SERVER
    ? undefined
    : {
        command: "npm run build && npm run start",
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
        env: {
          NEXT_PUBLIC_STRIPE_BASIC_MONTHLY: process.env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY ?? "price_test_basic_monthly",
          NEXT_PUBLIC_STRIPE_BASIC_ANNUAL: process.env.NEXT_PUBLIC_STRIPE_BASIC_ANNUAL ?? "price_test_basic_annual",
          NEXT_PUBLIC_STRIPE_PRO_MONTHLY: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY ?? "price_test_pro_monthly",
          NEXT_PUBLIC_STRIPE_PRO_ANNUAL: process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL ?? "price_test_pro_annual",
          NEXT_PUBLIC_STRIPE_ALL_ACCESS_MONTHLY:
            process.env.NEXT_PUBLIC_STRIPE_ALL_ACCESS_MONTHLY ?? "price_test_all_access_monthly",
          NEXT_PUBLIC_STRIPE_ALL_ACCESS_ANNUAL:
            process.env.NEXT_PUBLIC_STRIPE_ALL_ACCESS_ANNUAL ?? "price_test_all_access_annual",
          NEXT_PUBLIC_STRIPE_EXAM_3MONTH: process.env.NEXT_PUBLIC_STRIPE_EXAM_3MONTH ?? "price_test_exam_3m",
          NEXT_PUBLIC_STRIPE_EXAM_6MONTH: process.env.NEXT_PUBLIC_STRIPE_EXAM_6MONTH ?? "price_test_exam_6m",
          NEXT_PUBLIC_STRIPE_EXAM_12MONTH: process.env.NEXT_PUBLIC_STRIPE_EXAM_12MONTH ?? "price_test_exam_12m",
        },
      },
})
