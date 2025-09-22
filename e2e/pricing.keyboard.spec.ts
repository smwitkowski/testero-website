import { test, expect } from "@playwright/test"
import type { Response } from "@playwright/test"

const PRICING_PATH = "/pricing"

const ensureSuccess = (response: Response | null) => {
  if (!response) {
    throw new Error("Pricing page navigation returned null response")
  }
  if (!response.ok()) {
    throw new Error(`Expected pricing page to load successfully but received status ${response.status()}`)
  }
}

test.describe("Pricing page keyboard support", () => {
  test("primary CTA receives focus via keyboard and activates with Enter", async ({ page }, testInfo) => {
    const response = await page.goto(PRICING_PATH, { waitUntil: "networkidle" })
    ensureSuccess(response)

    const cta = page.getByRole("button", { name: /get started/i }).first()
    await expect(cta).toBeVisible()
    await expect(cta).toBeEnabled()

    await page.focus("body")

    let isFocused = false
    for (let i = 0; i < 120; i += 1) {
      await page.keyboard.press("Tab")
      if (await cta.evaluate((element) => element === document.activeElement)) {
        isFocused = true
        break
      }
    }

    expect(isFocused).toBeTruthy()
    await expect(cta).toBeFocused()
    await expect(cta).toBeFocused()

    const focusStyles = await cta.evaluate((element) => {
      const computed = window.getComputedStyle(element)
      return {
        outline: computed.outlineStyle,
        outlineWidth: computed.outlineWidth,
        boxShadow: computed.boxShadow,
      }
    })

    const focusVisible =
      focusStyles.outline !== "none" || focusStyles.boxShadow !== "none" || focusStyles.outlineWidth !== "0px"
    if (!focusVisible) {
      const screenshot = await page.screenshot()
      await testInfo.attach("cta-focus.png", { body: screenshot, contentType: "image/png" })
    }
    expect(focusVisible).toBe(true)

    await Promise.all([
      page.waitForURL(/\/signup\?redirect=\/pricing/i),
      page.keyboard.press("Enter"),
    ])
  })
})
