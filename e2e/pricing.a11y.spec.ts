import { test, expect } from "@playwright/test"
import type { Response } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"

const PRICING_PATH = "/pricing"

const assertSuccessfulResponse = (response: Response | null) => {
  if (!response) {
    throw new Error("Pricing page did not return a response")
  }
  if (response.status() >= 400) {
    throw new Error(`Expected pricing page to load successfully but received status ${response.status()}`)
  }
}

test.describe("Pricing page accessibility", () => {
  test("meets axe accessibility guidelines in light and dark themes", async ({ page }, testInfo) => {
    const response = await page.goto(PRICING_PATH, { waitUntil: "networkidle" })
    assertSuccessfulResponse(response)

    const lightResults = await new AxeBuilder({ page }).analyze()
    await testInfo.attach("axe-light.json", {
      body: JSON.stringify(lightResults.violations, null, 2),
      contentType: "application/json",
    })

    expect(lightResults.violations, "Light mode axe violations").toHaveLength(0)

    await page.evaluate(() => {
      document.documentElement.classList.add("dark")
      document.body.classList?.add("dark")
    })

    const darkResults = await new AxeBuilder({ page }).analyze()
    await testInfo.attach("axe-dark.json", {
      body: JSON.stringify(darkResults.violations, null, 2),
      contentType: "application/json",
    })

    expect(darkResults.violations, "Dark mode axe violations").toHaveLength(0)

    const recommendedBadge = page.locator('[data-slot="badge"]', { hasText: /most popular/i })
    await expect(recommendedBadge).toBeVisible()
  })
})
